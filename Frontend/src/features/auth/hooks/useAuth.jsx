import { useDispatch, useSelector } from "react-redux"
import { useLocation, useNavigate } from "react-router-dom"
import useLoginPrompt from './useLoginPrompt'
import { useMutation } from "@tanstack/react-query"
import { logout } from "../store/authSlice"
import { selectUser } from "../store/authSelector"
import logOut from "../api/logout"
import logoutAll from "../api/logoutAll"
import useToast from '@/shared/hooks/useToast'

export default function useAuth() {
  const user = useSelector(selectUser)
  const avatarUrl = useSelector(state => state.auth.avatarUrl)
  const navigate = useNavigate()
  const location = useLocation()
  const signIn = useLoginPrompt()
  const dispatch = useDispatch()
  const { notify } = useToast()

  const logoutMutation = useMutation({
    mutationFn: logOut,
    
    onSuccess: () => {
      dispatch(logout())
      navigate('/login')
    },
    
    onError: () => {
      notify('Sign out failed. Please try again.', { tone: 'error' })
    }
  })

  const logoutAllMutation = useMutation({
    mutationFn: logoutAll,
    
    onSuccess: () => {
      dispatch(logout())
      navigate('/login')
    },
    
    onError: () => {
      notify('Could not sign out other devices. Please try again.', { tone: 'error' })
    }
  })

  const signUp = () => {
    navigate('/signup', { state: { returnTo: `${location.pathname}${location.search}${location.hash}` } })
  }

  const signOut = async () => {
    if (logoutMutation.isPending || logoutAllMutation.isPending) return
    logoutMutation.mutate();
  }

  const signOutAllDevices = async () => {
    if (logoutMutation.isPending || logoutAllMutation.isPending) return
    logoutAllMutation.mutate();
  }

  const completeOnboarding = () => {
    navigate('/')
  }

  return {
    user,
    avatarUrl,
    loggedIn: !!user,
    isSigningOut: logoutMutation.isPending || logoutAllMutation.isPending,
    signIn,
    signUp,
    signOut,
    signOutAllDevices,
    completeOnboarding
  }
}
