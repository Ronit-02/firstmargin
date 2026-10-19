/* Login / Signup page */
import { useEffect, useRef, useState, forwardRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useMutation } from '@tanstack/react-query'
import { LogoIcon } from '@/shared/icons'
import { loginUser }  from '../api/login'
import { signupUser } from '../api/signup'
import { resendOtp } from '../api/resendOtp'
import { verifyEmail } from '../api/verifyEmail'
import { loginFailure, loginStart, loginSuccess } from '../store/authSlice'
import { googleLogin as requestGoogleLogin } from '../api/googleLogin'
import useToast from '@/shared/hooks/useToast'
import { useTheme } from '@/shared/hooks/useTheme'
import { safeReturnTo } from '../utils/returnTo'

export default function Login({ signUp = false, embedded = false, returnTo, onSignedIn }) {
  const navigate = useNavigate()
  const location = useLocation()
  const afterSignIn = safeReturnTo(returnTo ?? location.state?.returnTo)
  const finishSignIn = () => {
    onSignedIn?.()
    if (!embedded || afterSignIn !== `${location.pathname}${location.search}${location.hash}`) navigate(afterSignIn, { replace: true })
  }
  const dispatch = useDispatch()
  const { notify } = useToast()
  const { dark } = useTheme()
  const AUTH_TABS = ['login', 'signup']
  const [embeddedMode, setEmbeddedMode] = useState(signUp ? 'signup' : 'login')
  const mode = embedded ? embeddedMode : location.pathname === '/signup' ? 'signup' : 'login'
  const setMode = nextMode => {
    if (embedded) setEmbeddedMode(nextMode)
    else if (nextMode !== mode) navigate({ pathname: nextMode === 'signup' ? '/signup' : '/login', search: location.search, hash: location.hash })
  }
  const [ isEmailVerified, setIsEmailVerified ] = useState(true)
  const [ creds, setCreds ] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [ otp, setOtp ] = useState(['', '', '', '', '', ''])
  const boxInputRefs = useRef([])
  const googleButtonRef = useRef(null)
  const googlePendingRef = useRef(false)
  
  const loginMutation  = useMutation({ 
    mutationFn: loginUser,  
    
    onSuccess: (data) => { 
      dispatch(loginSuccess(data));
      notify('Welcome back.')
      finishSignIn()
    },
    
    onError: (error) => {
      dispatch(loginFailure(error?.response?.data?.message || 'Unable to log in at this time'))
      const code = error?.response?.data?.code;

      if (code === 'EMAIL_NOT_VERIFIED') {
        setIsEmailVerified(false);
      }
    }
  })

  const signupMutation = useMutation({ 
    mutationFn: signupUser,
    
    onSuccess: () => {
      notify('Account created. Check your email to verify it.')
      setIsEmailVerified(false)
    },
    
    onError: error => notify(error?.response?.data?.message || 'Account creation failed.', { tone: 'error' }),
  })

  const verifyEmailMutation = useMutation({
    mutationFn: verifyEmail,
    
    onSuccess: (data) => {
      setIsEmailVerified(true)
      dispatch(loginSuccess(data));
      notify('Email verified.')
      if (mode === 'signup') {
        onSignedIn?.()
        navigate('/onboarding')
      } else finishSignIn()
    },

    onError: error => notify(error?.response?.data?.message || 'Email verification failed.', { tone: 'error' }),
  })

  const resendOtpMutation = useMutation({
    mutationFn: resendOtp,
    
    onSuccess: () => {
      notify('Verification code sent again.')
    }
  })

  const googleMutation = useMutation({
    mutationFn: requestGoogleLogin,
    onSuccess: data => {
      dispatch(loginSuccess(data))
      notify('Welcome to firstmargin.')
      finishSignIn()
    },
    onSettled: () => { googlePendingRef.current = false },
  })

  const triggerGoogleLogin = googleMutation.mutate

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId || !isEmailVerified || !googleButtonRef.current) return undefined
    const renderButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return
      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: response => {
          if (googlePendingRef.current) return
          googlePendingRef.current = true
          dispatch(loginStart())
          triggerGoogleLogin(response.credential)
        },
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: dark ? 'filled_black' : 'outline', size: 'large', width: Math.min(400, googleButtonRef.current.clientWidth), text: 'continue_with' })
    }
    window.addEventListener('resize', renderButton)
    if (window.google?.accounts?.id) {
      renderButton()
      return () => window.removeEventListener('resize', renderButton)
    }
    const existingScript = document.querySelector('script[data-google-identity]')
    const script = existingScript || document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    if (!existingScript) document.head.appendChild(script)
    script.addEventListener('load', renderButton)
    return () => {
      script.removeEventListener('load', renderButton)
      window.removeEventListener('resize', renderButton)
    }
  }, [dark, dispatch, triggerGoogleLogin, isEmailVerified, mode])

  const handleSubmit = e => {
    e.preventDefault()
    if (loginMutation.isPending || signupMutation.isPending) return
    if (mode === 'signup' && creds.password !== creds.confirmPassword) return
    dispatch(loginStart())
    if (mode === 'login') loginMutation.mutate({ email: creds.email, password: creds.password })
    else signupMutation.mutate({ username: creds.name, email: creds.email, password: creds.password })
  }

  const handleVerifyEmail = e => {
    e.preventDefault()
    if (verifyEmailMutation.isPending || resendOtpMutation.isPending) return
    verifyEmailMutation.mutate({ email: creds.email, otp: otp.join('') })
  }

  const handleResendOtp = e => {
    e.preventDefault()
    if (verifyEmailMutation.isPending || resendOtpMutation.isPending) return
    resendOtpMutation.mutate({ email: creds.email })
  }
  const handleAuthTabKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const tabs = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="tab"]'))
    const index = tabs.indexOf(event.currentTarget)
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    event.preventDefault()
    const next = tabs[nextIndex]
    setMode(next.id.replace('auth-tab-', ''))
    next.focus()
  }
  const authError = loginMutation.error?.response?.data?.message || signupMutation.error?.response?.data?.message
  const passwordsDiffer = mode === 'signup' && creds.confirmPassword && creds.password !== creds.confirmPassword

  return (
    <div className={embedded ? 'text-[var(--color-text)]' : 'relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]'} role={embedded ? undefined : 'main'}>
      {!embedded && <>
        <svg aria-hidden="true" data-testid="auth-ink" viewBox="0 0 560 800" fill="none" className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[min(46vw,560px)] text-[var(--color-text-muted)] opacity-35 lg:block">
          <path d="M560 104C525 221 427 290 352 351C300 394 346 422 414 382C463 353 446 310 395 330C314 362 294 482 236 560C179 636 114 681 28 780" stroke="currentColor" strokeWidth="1.15" />
        </svg>
      </>}

      {!isEmailVerified 
        ?
        <VerifyEmail 
          otp={otp} 
          setOtp={setOtp} 
          handleVerifyEmail={handleVerifyEmail} 
          handleResendOtp={handleResendOtp}
          boxInputRefs={boxInputRefs}
          verifying={verifyEmailMutation.isPending}
          resending={resendOtpMutation.isPending}
          embedded={embedded}
        />
        :
        <div className={embedded ? 'flex min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--color-bg)] px-4 pb-4 sm:px-6 sm:pb-6 lg:px-10 lg:pb-10' : 'relative z-10 flex min-w-0 flex-1 items-start px-5 pb-8 pt-14 sm:items-center sm:px-8 sm:py-8 lg:mx-auto lg:w-full lg:max-w-[1120px] lg:px-20 lg:py-12'}>
          <form id="auth-form" onSubmit={handleSubmit} className={embedded ? 'w-full flex flex-col px-0 py-2' : 'mx-auto flex w-full max-w-[448px] shrink-0 flex-col py-4 lg:mx-0'}>

            {!embedded && <Link to="/" aria-label="Return to firstmargin home" className="mb-7 inline-flex w-fit self-center items-center gap-2 rounded-lg text-[var(--color-text)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2">
              <span className="flex h-9 w-9 items-center justify-center text-[var(--color-text)] [&_svg]:h-7 [&_svg]:w-7"><LogoIcon /></span>
              <span className="text-[17px] font-semibold">firstmargin</span>
            </Link>}

            {/* Authentication Tabs */}
            <div role="tablist" aria-label="Authentication mode" className={embedded ? 'mb-5 flex rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg)] p-1' : 'mb-8 flex min-h-12 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] p-1 sm:mb-10'}>
              {AUTH_TABS.map(m => (
                <button 
                  type="button"
                  role="tab"
                  id={`auth-tab-${m}`}
                  aria-selected={mode === m}
                  aria-controls="auth-form-fields"
                  tabIndex={mode === m ? 0 : -1}
                  onKeyDown={handleAuthTabKeyDown}
                  key={m} 
                  onClick={() => setMode(m)}
                  className={`button-target flex-1 border-none text-[14px] font-medium cursor-pointer transition-colors duration-150 ${embedded ? 'rounded-md py-2.5' : 'rounded-full py-2'}
                    ${mode === m ? embedded ? 'bg-[var(--color-surface-hover)] shadow-[0_2px_6px_rgba(0,0,0,0.12)] text-[var(--color-text)]' : 'bg-[var(--color-bg-alt)] text-[var(--color-text)]' : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}>
                  {m === 'login' ? 'Login' : 'Sign Up'}
                </button>
              ))}
            </div>

            <div id="auth-form-fields" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
            {/* Greetings */}
            <h2 style={embedded ? undefined : { fontFamily: 'var(--font-display)' }} className={embedded ? 'mb-1.5 text-[24px] font-bold text-[var(--color-text)]' : 'mb-2 text-[clamp(1.85rem,4vw,2.75rem)] leading-tight text-[var(--color-text)]'}>
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className={embedded ? 'mb-6 text-[14px] text-[var(--color-text-secondary)]' : 'mb-7 text-[14px] text-[var(--color-text-secondary)] sm:mb-8'}>
              {mode === 'login' && !embedded ? 'Pick up where your thoughts left off.' : mode === 'login' ? 'Login to continue your journey' : 'Join and start writing today'}
            </p>

            {/* Fields */}
            {mode === 'signup' && (
              <FormField 
                type="text" 
                name="name"
                autoComplete="name"
                placeholder="Full Name" 
                showLabel={!embedded}
                required
                value={creds.name}    
                onChange={e => setCreds({ ...creds, name: e.target.value })} 
              />
            )}
            <FormField 
              type="email" 
              name="email"
              autoComplete="email"
              placeholder="Email" 
              showLabel={!embedded}
              required
              value={creds.email}    
              onChange={e => setCreds({ ...creds, email: e.target.value })} 
            />
            <FormField 
              type="password" 
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="Password" 
              showLabel={!embedded}
              required
              value={creds.password}    
              onChange={e => setCreds({ ...creds, password: e.target.value })} 
            />
            {mode === 'signup' && (
              <FormField 
                type="password" 
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm Password" 
                showLabel={!embedded}
                required
                value={creds.confirmPassword}    
                onChange={e => setCreds({ ...creds, confirmPassword: e.target.value })} 
              />
            )}

            {(passwordsDiffer || authError) && <p role="alert" className="mb-2 text-[12px] text-[var(--color-danger)]">{passwordsDiffer ? 'Passwords do not match.' : authError}</p>}

            {/* Submit */}
            <button type="submit" disabled={loginMutation.isPending || signupMutation.isPending || passwordsDiffer}
              className="button-target mt-2.5 w-full rounded-lg border-none bg-[var(--color-accent)] py-3 text-[15px] font-medium text-[var(--color-text-inverted)] transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60" aria-busy={loginMutation.isPending || signupMutation.isPending}>
              {mode === 'login' ? 'Login' : 'Sign Up'}
            </button>
            {import.meta.env.VITE_GOOGLE_CLIENT_ID && <><div className="my-5 flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]"><span className="h-px flex-1 bg-[var(--color-border)]" />or<span className="h-px flex-1 bg-[var(--color-border)]" /></div><div ref={googleButtonRef} aria-busy={googleMutation.isPending} inert={googleMutation.isPending ? "" : undefined} className="flex min-h-10 justify-center" />{googleMutation.error && <p role="alert" className="mt-2 text-center text-[12px] text-[var(--color-danger)]">{googleMutation.error?.response?.data?.message || 'Google sign-in failed.'}</p>}</>}
            </div>
          </form>
        </div>
      }
    </div>
  )
}

function VerifyEmail({otp, setOtp, boxInputRefs, handleVerifyEmail, handleResendOtp, verifying, resending, embedded}) {

  const handleChange = (value, index) => {
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1) // Ensure only one digit
    setOtp(newOtp)

    // Move to next box if a digit is entered
    if (value && index < otp.length - 1) {
      boxInputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (e, index) => {
    // Move back to previous box on Backspace if current box is empty
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      boxInputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <div className={embedded ? 'flex min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--color-bg)] px-4 pb-4 sm:px-6 sm:pb-6 lg:px-10 lg:pb-10' : 'relative z-10 flex min-w-0 flex-1 items-start px-5 pb-8 pt-14 sm:items-center sm:px-8 sm:py-8 lg:mx-auto lg:w-full lg:max-w-[1120px] lg:px-20 lg:py-12'}>
      <div className={embedded ? 'w-full flex flex-col items-center gap-4 py-2' : 'mx-auto flex w-full max-w-[448px] shrink-0 flex-col items-center gap-4 py-4 lg:mx-0'}>

        <h2 className="text-[24px] font-bold mb-1.5 text-(--color-text-primary)">
          Enter Verification Code
        </h2>

        <p className="text-[14px] text-(--color-text-muted) mb-6 text-center">
          Enter the 6-digit code we sent to your email to verify your account!
        </p>

        {/* Boxes */}
        <div className="flex w-full gap-1.5 sm:gap-3 mb-6">
          {otp.map((digit, index) => (
            <BoxField
              key={index}
              placeholder=" "
              ref={(el) => boxInputRefs.current[index] = el}
              value={digit}
              onChange={el => handleChange(el.target.value, index)}
              onKeyDown={el => handleKeyDown(el, index)}
              label={`Verification digit ${index + 1}`}
            />
          ))}
        </div>

        <button type="button" onClick={handleResendOtp} disabled={verifying || resending} aria-busy={resending}
          className='button-target text-[12px] text-(--color-text-muted) hover:text-(--color-accent) transition-colors mr-auto'
        >
          Resend OTP
        </button>

          {/* Submit */}
        <button type="button" onClick={handleVerifyEmail} disabled={verifying || resending} aria-busy={verifying}
          className="button-target mt-2.5 w-full rounded-lg border-none bg-[var(--color-accent)] py-3 text-[15px] font-medium text-[var(--color-text-inverted)] transition-colors hover:bg-[var(--color-accent-hover)]">
          Verify Email
        </button>
      </div>
    </div>
  )
}

function FormField({type, name, autoComplete, placeholder, value, onChange, required = false, showLabel = false}){
  return (
    <div className="mb-3.5 w-full">
    {showLabel && <label htmlFor={`auth-${name}`} className="mb-2 block text-[14px] font-medium text-[var(--color-text)]">{placeholder}</label>}
    <input
      id={`auth-${name}`}
      type={type} 
      name={name}
      autoComplete={autoComplete}
      required={required}
      aria-label={placeholder}
      placeholder={showLabel ? name === 'email' ? 'you@example.com' : name === 'password' ? 'Enter your password' : '' : placeholder}
      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-3 text-[14px] text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
      value={value}
      onChange={onChange} />
    </div>
  )
}

const BoxField = forwardRef(
  function BoxField(
    { placeholder, value, onChange, onKeyDown, label },
    ref
  ) {
    return (
      <input 
        type="text" 
        maxLength="1"
        inputMode="numeric"
        aria-label={label}
        placeholder={placeholder}
        className="h-11 min-w-0 w-full flex-1 sm:h-12 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] text-center text-[var(--color-text)] transition-colors focus:border-[var(--color-accent)]"
        value={value}
        onChange={onChange}
        ref={ref}
        onKeyDown={onKeyDown}
      />
    )
  }
);
