const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { verifyPassword, hashPassword, generateToken, verifyToken, generateRandom, generateOTP, getOTPHTML } = require('../utils/helper');
const { Avatars } = require('../assets/data');
const Profile = require('../schemas/profile.schema');
const { sendEmail } = require('../services/email.service.js');
const User = require('../schemas/user.schema');
const Session = require('../schemas/session.schema');
const OTP = require('../schemas/otp.schema');
const config = require('../config/config');
const { createProfileForUser } = require('../services/profile.service');
const { profileAvatarPublicIdFromUrl } = require('../utils/cloudinary');

const refreshCookieOptions = {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const googleClient = config.GOOGLE_CLIENT_ID ? new OAuth2Client(config.GOOGLE_CLIENT_ID) : null;
const dummyPasswordHash = hashPassword(crypto.randomBytes(32).toString('hex'));
const isValidEmailInput = value => typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const randomAvatar = () => Avatars[generateRandom(0, Avatars.length - 1)];
const withProviderTimeout = promise => {
    let timer;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Provider timeout')), config.PROVIDER_TIMEOUT_MS);
        timer.unref();
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const createSessionTokens = async (user, req) => {
    const sessionId = crypto.randomUUID();
    const accessToken = generateToken({ id: user._id }, '10m', 'access');
    const refreshToken = generateToken({ id: user._id, sessionId }, '7d', 'refresh');
    await Session.create({
        user: user._id,
        sessionId,
        ip: req.ip,
        userAgent: String(req.get('User-Agent') || 'unknown').slice(0, 512),
        expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
    });
    return { accessToken, refreshToken };
};

const clearRefreshCookie = (res) => {
    const clearOptions = { ...refreshCookieOptions };
    delete clearOptions.maxAge;
    res.clearCookie('refreshToken', clearOptions);
};

const createGoogleUsername = async (name, email) => {
    const base = String(name || email.split('@')[0] || 'firstmargin writer')
        .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'firstmargin-writer';
    let username = base;
    let suffix = 1;
    while (await User.exists({ username })) {
        username = `${base}-${suffix}`.slice(0, 30);
        suffix += 1;
    }
    return username;
};

const verifyGoogleCredential = async credential => {
    if (!config.GOOGLE_CLIENT_ID) {
        const error = new Error('Google authentication is not configured');
        error.code = 'GOOGLE_NOT_CONFIGURED';
        throw error;
    }
    try {
        const ticket = await withProviderTimeout(googleClient.verifyIdToken({ idToken: credential, audience: config.GOOGLE_CLIENT_ID }));
        const claims = ticket.getPayload();
        if (!claims || !claims.email_verified || !claims.sub || !claims.email) throw new Error('Invalid claims');
        return claims;
    } catch {
        const error = new Error('Invalid Google credential');
        error.code = 'GOOGLE_CREDENTIAL_INVALID';
        throw error;
    }
};

const googleLogin = async (req, res) => {
    try {
        const credential = String(req.body?.credential || '').trim();
        if (!credential || credential.length > 10_000) return res.status(400).json({ success: false, message: 'Google credential is required' });
        const claims = await verifyGoogleCredential(credential);
        const email = claims.email.trim().toLowerCase();
        let user = await User.findOne({ googleId: claims.sub });

        if (!user) {
            const emailUser = await User.findOne({ email });
            if (emailUser) {
                if (emailUser.googleId && emailUser.googleId !== claims.sub) {
                    return res.status(409).json({
                        success: false,
                        code: 'GOOGLE_IDENTITY_CONFLICT',
                        message: 'Unable to sign in with Google',
                    });
                }
                if (!emailUser.googleId) {
                    return res.status(409).json({
                        success: false,
                        code: 'GOOGLE_ACCOUNT_COLLISION',
                        message: 'Unable to sign in with Google',
                    });
                }
                user = emailUser;
            }
        }

        if (user) {
            if (user.accountStatus === 'suspended') return res.status(403).json({ success: false, message: 'Unable to sign in' });
            user.googleId = claims.sub;
            user.verified = true;
            const previousPicture = user.picture || null;
            const currentProfile = await Profile.findOne({ userId: user._id }).select('avatarUrl');
            const customAvatar = profileAvatarPublicIdFromUrl(currentProfile?.avatarUrl, user._id);
            user.picture = customAvatar ? currentProfile.avatarUrl : claims.picture || user.picture || randomAvatar();
            if (!customAvatar && (user.picture !== previousPicture || !previousPicture)) {
                await Profile.updateOne(
                    { userId: user._id, $or: [{ avatarUrl: null }, { avatarUrl: previousPicture }] },
                    { $set: { avatarUrl: user.picture } },
                );
            }
            await user.save();
        } else {
            user = await User.create({ username: await createGoogleUsername(claims.name, email), email, googleId: claims.sub, picture: claims.picture || randomAvatar(), verified: true });
            await createProfileForUser({ userId: user._id, username: user.username, picture: user.picture });
        }

        const profile = await Profile.findOne({ userId: user._id }).select('avatarUrl');
        const { accessToken, refreshToken } = await createSessionTokens(user, req);
        res.cookie('refreshToken', refreshToken, refreshCookieOptions);
        return res.status(200).json({ success: true, message: 'Google login successful', token: accessToken, username: user.username, avatarUrl: profile?.avatarUrl || user.picture || null, email, role: user.role });
    } catch (err) {
        console.error(`[${req.requestId}] Google login failed`);
        if (err?.code === 'GOOGLE_NOT_CONFIGURED') return res.status(503).json({ success: false, code: err.code, message: 'Google authentication is not configured' });
        if (err?.code === 'GOOGLE_CREDENTIAL_INVALID') return res.status(401).json({ success: false, code: err.code, message: 'Google authentication failed' });
        return res.status(500).json({ success: false, message: 'Unable to sign in with Google at this time' });
    }
};

const login = async (req, res) => {
    
    try{
        // login data is sent in request body
        const { email, password } = req.body;
        if (!isValidEmailInput(email) || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({email: normalizedEmail});
        const passwordMatches = await verifyPassword(password, user?.password || await dummyPasswordHash);
        if (!user || user.googleId || user.accountStatus === 'suspended' || !passwordMatches) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // check if email is verified, if not generate OTP and send to email for verification
        if(!user.verified){
            
            // Generating OTP and saving in database
            const otp = generateOTP();
            const otpHash = await hashPassword(otp);
            const otpHtml = getOTPHTML(otp);
            await OTP.deleteMany({ email: normalizedEmail });
            await OTP.create({
                email: normalizedEmail,
                user: user._id,
                otpHash,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000) // OTP expires in 10 minutes
            })

            // Sending OTP to user's email
            await sendEmail(
                normalizedEmail,
                'firstmargin - Email Verification',
                `Your OTP for email verification is ${otp}`,
                otpHtml
            )
            return res.status(400).json({
                success: false,
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please verify your email before logging in'
            });
        }

        // verifying password
        if(passwordMatches){
                
                // Issuing a JWT
                const { accessToken, refreshToken } = await createSessionTokens(user, req);

                // Setting refresh token in cookie
                res.cookie('refreshToken', refreshToken, refreshCookieOptions);
                
                return res.status(200).json({
                    success: true,
                    message: 'Login successful',
                    token: accessToken, 
                    username: user.username, 
                    avatarUrl: user.picture || null,
                    email: normalizedEmail, 
                    role: user.role
                });
        }
        else{
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
    }
    catch(err){
        console.error(`[${req.requestId}] Login failed`);
        if (err?.code === 'PROVIDER_NOT_CONFIGURED') return res.status(503).json({ code: err.code, message: 'Email verification is not configured' });
        return res.status(500).json({
            success: false, 
            message: 'Unable to log in at this time'
        });
    }
}

const signup = async (req, res) => {

    try{
        // signup data is sent in request body
        const { username, email, password } = req.body;
        if (typeof username !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,29}$/u.test(username.trim()) || !isValidEmailInput(email) || typeof password !== 'string' || !password) {
            return res.status(400).json({ success: false, message: 'Username, email, and password are required' });
        }
        if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(400).json({ success: false, message: 'Password must be between 8 and 72 bytes' });
        }

        const normalizedUsername = username.trim();
        const normalizedEmail = email.trim().toLowerCase();
        
        // Assigning a random image from assets
        const random = generateRandom(0, Avatars.length - 1);
        const picture = Avatars[random];
    
        // Hashing password
        const hashedPassowrd = await hashPassword(password);
    
        // Email and Username Validation
        const existingEmailUser = await User.findOne({ email: normalizedEmail }).select('googleId');
        if(existingEmailUser){
            return res.status(409).json({
                success: false,
                message: 'Email or username already in use'
            });
        } 
        if(await User.findOne({username: normalizedUsername})){
            return res.status(409).json({
                success: false,
                message: 'Username already in use'
            });
        }

        // Creating User
        const user = new User({
            picture: picture,
            username: normalizedUsername, 
            email: normalizedEmail, 
            password: hashedPassowrd
        });
        await user.save();

        try {
            await createProfileForUser({
                userId: user._id,
                username: normalizedUsername,
                picture,
            });
        } catch (profileError) {
            await User.deleteOne({ _id: user._id });
            throw profileError;
        }

        // Generating OTP and saving in database
        const otp = generateOTP();
        const otpHash = await hashPassword(otp);
        const otpHtml = getOTPHTML(otp);
        await OTP.create({
            email: normalizedEmail,
            user: user._id,
            otpHash,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // OTP expires in 10 minutes
        })

        // Sending OTP to user's email
        await sendEmail(
            normalizedEmail,
            'firstmargin - Email Verification',
            `Your OTP for email verification is ${otp}`,
            otpHtml
        )

        return res.status(200).json({
            success: true,
            message: 'Signup successful, please verify your email'
        });
    }
    catch(err){
        console.error(`[${req.requestId}] Signup failed`);
        if (err?.code === 'PROVIDER_NOT_CONFIGURED') return res.status(503).json({ code: err.code, message: 'Email verification is not configured' });
        if (err?.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email or username already in use'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Cant Signup now, try again later'
        })
    }
}

const verifyEmail = async (req, res) =>{
    try{
        const { email, otp } = req.body;
        if (!isValidEmailInput(email) || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({ success: false, message: 'Email and a 6-digit OTP are required' });
        }
        const normalizedEmail = email.trim().toLowerCase();

        const otpRecord = await OTP.findOneAndUpdate(
            { email: normalizedEmail, expiresAt: { $gt: new Date() }, failedAttempts: { $lt: 5 } },
            { $inc: { failedAttempts: 1 } },
            { new: true }
        );
        if(!otpRecord)
            return res.status(400).json({
                success: false,
                code: "OTP_INVALID",
                message: 'Unable to verify email'
            });

        if(await verifyPassword(otp, otpRecord.otpHash)){

            // Marking user as verified
            await User.findOneAndUpdate(
                { email: normalizedEmail }, 
                { verified: true }
            );
            
            // Deleting all OTPs of the user after successful verification
            await OTP.deleteMany({email: normalizedEmail}); 

            // Issuing JWT
            const user = await User.findOne({email: normalizedEmail});
            if (!user || user.accountStatus === 'suspended') {
                await OTP.deleteMany({ email: normalizedEmail });
                return res.status(400).json({ success: false, message: 'Unable to verify email' });
            }
            const { accessToken, refreshToken } = await createSessionTokens(user, req);

            // Setting refresh token in httpOnly cookie
            res.cookie('refreshToken', refreshToken, refreshCookieOptions);

            return res.status(200).json({
                success: true,
                message: 'Email verified successfully',
                token: accessToken, 
                username: user.username, 
                avatarUrl: user.picture || null,
                email: normalizedEmail,
                role: user.role, 
            });
        }
        else{
            if (otpRecord.failedAttempts >= 5) {
                await OTP.deleteOne({ _id: otpRecord._id });
            }
            return res.status(400).json({
                success: false,
                message: 'Unable to verify email'
            });
        }
    } 
    catch(err){
        console.error(`[${req.requestId}] Email verification failed`);
        return res.status(500).json({
            success: false,
            message: 'Cant verify email now, try again later'
        })
    }        
}

const logout = async (req, res) => {
    try{
        const refreshToken = req.cookies.refreshToken;
        if(!refreshToken){
            return res.status(401).json({
                message: 'Refresh token not found, login again'
            });
        }

        // Find and Update session to revoke refresh token
        const decoded = verifyToken(refreshToken, 'refresh');
        await Session.findOneAndUpdate(
            { sessionId: decoded.sessionId, revoked: false },
            { revoked: true, revokedAt: new Date() }
        );

        // Clearing refresh token cookie
        clearRefreshCookie(res);

        return res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    }
    catch(err){
        console.error(`[${req.requestId}] Logout failed`);
        return res.status(500).json({
            success: false,
            message: 'Cant logout now, try again later'
        })
    }
}

const logoutAll = async (req, res) => {
    try{
        const refreshToken = req.cookies.refreshToken;
        if(!refreshToken){
            return res.status(401).json({
                message: 'Refresh token not found, login again'
            });
        }

        // verifying refresh token to get user id
        const decoded = verifyToken(refreshToken, 'refresh');

        // revoking all refresh tokens of the user
        await Session.updateMany(
            { user: decoded.id, revoked: false },
            { revoked: true, revokedAt: new Date() }
        );

        // clearing refresh token cookie
        clearRefreshCookie(res);

        return res.status(200).json({
            success: true,
            message: 'All sessions logged out successfully'
        });
    }
    catch(err){
        console.error(`[${req.requestId}] Logout-all failed`);
        return res.status(500).json({
            success: false,
            message: 'Cant logout all sessions now, try again later'
        })
    }
}

const resendOtp = async (req, res) => {
    try{
        const { email } = req.body;
        if (!isValidEmailInput(email)) return res.status(400).json({ message: 'A valid email is required' });
        const normalizedEmail = email.trim().toLowerCase();

        // Check if user exists and not verified
        const user = await User.findOne({email: normalizedEmail});
        if(!user || user.verified || user.accountStatus === 'suspended')
            return res.status(200).json({ success: true, message: 'If the account is eligible, a verification code will be sent' });

        // delete old OTPs
        await OTP.deleteMany({email: normalizedEmail});

        // Generating OTP and saving in database
        const otp = generateOTP();
        const otpHash = await hashPassword(otp);
        const otpHtml = getOTPHTML(otp);
        await OTP.create({
            email: normalizedEmail,
            user: user._id,
            otpHash,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // OTP expires in 10 minutes
        })

        // Sending OTP to user's email
        await sendEmail(
            normalizedEmail,
            'firstmargin - Email Verification',
            `Your OTP for email verification is ${otp}`,
            otpHtml
        )

        return res.status(200).json({
            success: true,
            message: 'If the account is eligible, a verification code will be sent'
        });
    }
    catch(err){
        console.error(`[${req.requestId}] OTP resend failed`);
        if (err?.code === 'PROVIDER_NOT_CONFIGURED') return res.status(503).json({ code: err.code, message: 'Email verification is not configured' });
        return res.status(500).json({
            success: false,
            message: 'Cant resend OTP now, try again later'
        })
    }
}

const refreshToken = async (req, res) => {
    try{
        const refreshToken = req.cookies.refreshToken;
        if(!refreshToken){
            return res.status(401).json({
                success: false,
                message: 'Refresh token not found, login again'
            });
        }
        
        // verifying refresh token and finding if its revoked or not
        const decoded = verifyToken(refreshToken, 'refresh');
        const session = await Session.findOne({
            sessionId: decoded.sessionId,
            user: decoded.id,
            expiresAt: { $gt: new Date() },
            revoked: false
        })
        if(!session){
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token, login again'
            });
        }
        
        // finding user
        const user = await User.findById(decoded.id);
        if(!user || user.accountStatus === 'suspended' || !user.verified){
            await Session.updateMany({ user: decoded.id, revoked: false }, { revoked: true, revokedAt: new Date() });
            clearRefreshCookie(res);
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        // generating new access token
        const newSessionId = crypto.randomUUID();
        const newAccessToken = generateToken({ id: user._id }, '10m', 'access');
        const newRefreshToken = generateToken({ id: user._id, sessionId: newSessionId }, '7d', 'refresh');
        session.sessionId = newSessionId;
        session.lastUsedAt = new Date();
        session.expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
        await session.save();
        res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);

        const profile = await Profile.findOne({ userId: user._id }).select('avatarUrl');
        return res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            accessToken: newAccessToken,
            user: user.username,
            avatarUrl: profile?.avatarUrl || user.picture || null,
            email: user.email,
            role: user.role
        });
    }
    catch(err){

        // Refresh Token expired
        if(err.name === 'TokenExpiredError'){
            return res.status(401).json({
                success: false,
                message: 'Refresh token expired, login again'
            });
        }

        // Invalid token
        if(err.name === 'JsonWebTokenError'){
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        console.error(`[${req.requestId}] Token refresh failed`);        
        return res.status(500).json({
            success: false,
            message: 'Cant refresh token now, try again later'
        })
    }
}

module.exports = {
    login,
    signup,
    verifyEmail,
    logout,
    logoutAll,
    resendOtp,
    refreshToken,
    googleLogin
}
