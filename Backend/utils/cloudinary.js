const { v2:cloudinary } = require('cloudinary');
const config = require('../config/config.js')

cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try{
        if(!localFilePath)
            return null;

        // uploading
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })

        return response;
    }
    catch(error){
        console.error('Cloudinary upload failed');
        return null;
    }
}

const removeOnCloudinary = async (imageURL) => {

    // extracting public id from url
    const publicId = imageURL.split('/upload/')[1].split('/')[1].split('.')[0];
    await cloudinary.uploader.destroy(publicId)
}

const uploadProfileAvatar = (localFilePath, userId) => cloudinary.uploader.upload(localFilePath, {
    resource_type: 'image',
    folder: `profile-avatars/${userId}`,
});

const profileAvatarPublicIdFromUrl = (imageURL, userId) => {
    if (!imageURL || !config.CLOUDINARY_CLOUD_NAME) return null;
    try {
        const url = new URL(imageURL);
        if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null;
        const prefix = `/${config.CLOUDINARY_CLOUD_NAME}/image/upload/`;
        if (!url.pathname.startsWith(prefix)) return null;
        const path = url.pathname.slice(prefix.length);
        const match = /^v\d+\/profile-avatars\/([a-f\d]{24})\/([a-z\d_-]+)\.[a-z\d]+$/i.exec(path);
        return match && match[1] === String(userId) ? `profile-avatars/${match[1]}/${match[2]}` : null;
    } catch {
        return null;
    }
};

const removeProfileAvatar = publicId => cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });

module.exports = {
    uploadOnCloudinary, 
    removeOnCloudinary,
    uploadProfileAvatar,
    profileAvatarPublicIdFromUrl,
    removeProfileAvatar,
};
