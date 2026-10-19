import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import PageFrame from '@/shared/components/layout/PageFrame'
import Button from '@/shared/components/ui/Button'
import Avatar from '@/shared/components/ui/Avatar'
import { setAvatarUrl } from '@/features/auth/store/authSlice'
import useToast from '@/shared/hooks/useToast'
import retainRetryView from '@/shared/utils/retainRetryView'
import { useOnboardingOptions } from '@/features/onboarding/hooks/useOnboarding'
import { saveOnboarding, resetInferredInterests } from '@/features/onboarding/api/onboarding'
import ReadingInterestSettings from '../../components/ReadingInterestSettings'
import { fetchMyProfile, updateMyProfile, updateMyProfilePicture } from '../../api/profile'

type Profile = { displayName: string; bio: string; handle: string | null; avatarUrl?: string | null; writerStatus?: string; directRequestsEnabled?: boolean }

export default function EditProfilePage() {
  const profile = retainRetryView(useQuery<Profile>({ queryKey: ['me', 'profile'], queryFn: fetchMyProfile }))
  return <PageFrame>
    {profile.isLoading ? <><h1 className="mb-8 text-[24px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>Edit profile</h1><p role="status" className="text-[13px] text-[var(--color-text-muted)]">Loading profile…</p></>
      : profile.isError && !profile.data ? <><h1 className="mb-8 text-[24px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>Edit profile</h1><div><p role="alert" className="text-[13px] text-[var(--color-danger)]">We couldn’t load your profile.</p><Button variant="secondary" className="mt-4" onClick={() => profile.refetch()} aria-busy={profile.isFetching} disabled={profile.isFetching}>Try again</Button></div></>
        : profile.data && <ProfileEditForm profile={profile.data} />}
  </PageFrame>
}

function ProfileEditForm({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.displayName || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [memberRequestsEnabled, setMemberRequestsEnabled] = useState(Boolean(profile.directRequestsEnabled))
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [savedAvatarUrl, setSavedAvatarUrl] = useState(profile.avatarUrl || null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [savedProfile, setSavedProfile] = useState({ name: profile.displayName || '', bio: profile.bio || '', memberRequestsEnabled: Boolean(profile.directRequestsEnabled) })
  const [selectedOverride, setSelectedOverride] = useState<string[] | null>(null)
  const [savedTopics, setSavedTopics] = useState<string[] | null>(null)
  const [resetRequested, setResetRequested] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const options = useOnboardingOptions()
  const selected = selectedOverride ?? savedTopics ?? options.data?.selectedTopicSlugs ?? []
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const returnTo = '/profile' + (params.size ? '?' + params : '')
  const updateProfile = useMutation({ mutationFn: updateMyProfile })
  const updateAvatar = useMutation({ mutationFn: updateMyProfilePicture })
  const updateInterests = useMutation({ mutationFn: saveOnboarding })
  const resetInterests = useMutation({ mutationFn: resetInferredInterests })

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null)
      return undefined
    }
    const preview = URL.createObjectURL(avatarFile)
    setAvatarPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [avatarFile])

  const chooseAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setSaveError('Choose a JPG, PNG, WebP, or GIF no larger than 8 MB.')
      setAvatarFile(null)
      event.currentTarget.value = ''
      return
    }
    setSaveError('')
    setAvatarFile(file)
  }

  const toggleTopic = (slug: string) => {
    if (isSaving) return
    setSelectedOverride(current => {
      const values = current ?? selected
      return values.includes(slug) ? values.filter(value => value !== slug) : [...values, slug]
    })
  }
  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || isSaving) return
    setIsSaving(true)
    setSaveError('')
    let stage = 'profile'
    try {
      const nextProfile = { name: name.trim(), bio: bio.trim(), memberRequestsEnabled }
      const profileChanges: { username?: string; bio?: string; directRequestsEnabled?: boolean } = {}
      if (nextProfile.name !== savedProfile.name) profileChanges.username = nextProfile.name
      if (nextProfile.bio !== savedProfile.bio) profileChanges.bio = nextProfile.bio
      if (profile.writerStatus === 'writer' && nextProfile.memberRequestsEnabled !== savedProfile.memberRequestsEnabled) profileChanges.directRequestsEnabled = nextProfile.memberRequestsEnabled
      if (Object.keys(profileChanges).length) {
        await updateProfile.mutateAsync(profileChanges)
        setSavedProfile(nextProfile)
        await queryClient.invalidateQueries({ queryKey: ['me', 'profile'] })
        if (profile.handle) await queryClient.invalidateQueries({ queryKey: ['writer', profile.handle] })
      }
      stage = 'avatar'
      if (avatarFile) {
        const updated = await updateAvatar.mutateAsync(avatarFile)
        setSavedAvatarUrl(updated.avatarUrl)
        setAvatarFile(null)
        if (avatarInputRef.current) avatarInputRef.current.value = ''
        dispatch(setAvatarUrl(updated.avatarUrl))
        await queryClient.invalidateQueries({ queryKey: ['me', 'profile'] })
        if (profile.handle) await queryClient.invalidateQueries({ queryKey: ['writer', profile.handle] })
      }
      stage = 'interests'
      if (selectedOverride !== null) {
        await updateInterests.mutateAsync({ topicSlugs: selected, writerIds: [], completed: options.data?.completed ?? true })
        setSavedTopics(selected)
        setSelectedOverride(null)
        await queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      }
      stage = 'reset'
      if (resetRequested) {
        await resetInterests.mutateAsync()
        setResetRequested(false)
      }
      notify('Profile updated.')
      navigate(returnTo)
    } catch {
      setSaveError(stage === 'profile' ? 'Profile update failed. Please try again.' : stage === 'avatar' ? 'Profile picture could not be saved. Please try again.' : stage === 'interests' ? 'Reading interests could not be saved. Please try again.' : 'Inferred interests could not be reset. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }
  return <div className="max-w-2xl">
    <form id="profile-edit-form" onSubmit={submitProfile}>
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="min-w-0 text-[24px] font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>Edit profile</h1>
        <Button type="submit" disabled={!name.trim() || isSaving} aria-busy={isSaving}>Save</Button>
      </div>
      <section className="mb-7 flex items-center gap-5">
        <Avatar src={avatarPreview || savedAvatarUrl} name={name || profile.displayName} size={80} />
        <div className="min-w-0">
          <label htmlFor="profile-picture" className="text-[11px] font-semibold text-[var(--color-text-muted)]">Profile picture</label>
          <input ref={avatarInputRef} id="profile-picture" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={isSaving} onChange={chooseAvatar} className="mt-2 block w-full max-w-full text-[12px] text-[var(--color-text-secondary)] file:mr-3 file:rounded-full file:border file:border-[var(--color-border)] file:bg-[var(--color-surface)] file:px-3 file:py-2 file:text-[12px] file:font-medium file:text-[var(--color-text)]" />
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">JPG, PNG, WebP, or GIF, up to 8 MB. Saved with your other changes.</p>
        </div>
      </section>
      <div className="flex flex-col gap-2">
        <label htmlFor="profile-display-name" className="text-[11px] font-semibold text-[var(--color-text-muted)]">Display name <span aria-hidden="true">(required)</span><input id="profile-display-name" required minLength={1} maxLength={80} value={name} aria-describedby="profile-display-name-help" onChange={event => setName(event.target.value)} className="mt-1 w-full text-[13px] font-normal border border-[var(--color-border)] rounded-[10px] px-3 py-2 bg-[var(--color-bg-alt)] text-[var(--color-text)]" /></label>
        <p id="profile-display-name-help" className="text-right text-[11px] text-[var(--color-text-muted)]">{name.length}/80 characters</p>
        <label htmlFor="profile-biography" className="text-[11px] font-semibold text-[var(--color-text-muted)]">Biography <span className="font-normal">(optional)</span><textarea id="profile-biography" maxLength={500} value={bio} aria-describedby="profile-biography-help" onChange={event => setBio(event.target.value)} className="mt-1 h-24 w-full text-[13px] border border-[var(--color-border)] rounded-[10px] px-3 py-2 bg-[var(--color-bg-alt)] text-[var(--color-text)] resize-y" /></label>
        <p id="profile-biography-help" className="text-right text-[11px] text-[var(--color-text-muted)]">{bio.length}/500 characters</p>
      </div>
      {profile.writerStatus === 'writer' && <section className="py-7">
        <h2 className="text-[18px] font-semibold text-[var(--color-text)]">Member requests</h2>
        <p className="mt-2 mb-5 text-[13px] leading-6 text-[var(--color-text-secondary)]">Allow members to send you up to three private requests per month.</p>
        <Button type="button" variant="secondary" disabled={isSaving} onClick={() => setMemberRequestsEnabled(current => !current)} aria-pressed={memberRequestsEnabled}>{memberRequestsEnabled ? 'Turn off' : 'Turn on'}</Button>
        <p role="status" className="mt-3 text-[12px] text-[var(--color-text-secondary)]">Member requests are {memberRequestsEnabled ? 'on' : 'off'}{memberRequestsEnabled !== savedProfile.memberRequestsEnabled ? ' and will update when you save.' : '.'}</p>
      </section>}
      <ReadingInterestSettings options={options} selected={selected} onToggle={toggleTopic} resetRequested={resetRequested} onToggleReset={() => { if (!isSaving) setResetRequested(current => !current) }} />
      {saveError && <p role="alert" className="mt-5 text-[12px] text-[var(--color-danger)]">{saveError}</p>}
    </form>
  </div>
}
