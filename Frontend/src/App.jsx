import { lazy, Suspense } from 'react'
import { useSelector } from 'react-redux'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useServerUnavailable } from '@/app/serverAvailability'
import AppLayout         from '@/shared/components/layout/AppLayout'
import PublicRoute       from '@/app/routes/PublicRoute'
import PrivateRoute      from '@/app/routes/PrivateRoute'
import { LoginPromptProvider } from '@/features/auth/hooks/useLoginPrompt'

const LoginPage = lazy(() => import('@/features/auth/pages/Login'))
const HomePage = lazy(() => import('@/features/discovery/pages/Home'))
const ExplorePage = lazy(() => import('@/features/discovery/pages/Explore'))
const TrendingTab = lazy(() => import('@/features/discovery/pages/Explore/TrendingTab'))
const QuestionsTab = lazy(() => import('@/features/discovery/pages/Explore/QuestionsTab'))
const QuestionDetail = lazy(() => import('@/features/discovery/pages/Explore/QuestionDetail'))
const OpportunitiesPage = lazy(() => import('@/features/question/pages/OpportunitiesPage'))
const CompetitionsTab = lazy(() => import('@/features/discovery/pages/Explore/CompetitionsTab'))
const CompetitionDetail = lazy(() => import('@/features/discovery/pages/Explore/CompetitionDetail'))
const SearchPage = lazy(() => import('@/features/discovery/pages/Search'))
const PostPage = lazy(() => import('@/features/post/pages'))
const AuthorPage = lazy(() => import('@/features/user/pages/Author'))
const OnboardingPage = lazy(() => import('@/features/onboarding/pages'))
const WritePage = lazy(() => import('@/features/editor/pages'))
const CollectionsPage = lazy(() => import('@/features/collection/pages'))
const SavedPage = lazy(() => import('@/features/collection/pages/SavedPage'))
const CollectionDetail = lazy(() => import('@/features/collection/pages/CollectionDetail'))
const EditProfilePage = lazy(() => import('@/features/user/pages/Profile/EditProfilePage'))
const ProfilePage = lazy(() => import('@/features/user/pages/Profile'))
const WritingPage = lazy(() => import('@/features/user/pages/WritingPage'))
const SettingsPage = lazy(() => import('@/features/user/pages/Settings'))
const ShortsPage = lazy(() => import('@/features/discovery/pages/Search/ShortsTab'))
const SeriesPage = lazy(() => import('@/features/discovery/pages/SeriesPage'))
const ShortSeriesDetail = lazy(() => import('@/features/discovery/pages/ShortSeriesDetail'))
const ReadingHistoryPage = lazy(() => import('@/features/discovery/pages/ReadingHistory'))
const MemberHub = lazy(() => import('@/features/membership/pages/MemberHub'))
const MembershipPage = lazy(() => import('@/features/membership/pages/MembershipPage'))
const NotFound = lazy(() => import('@/app/pages/NotFound'))
const HelpPage = lazy(() => import('@/app/pages/HelpPage'))
const NotificationsPage = lazy(() => import('@/features/notification/pages/NotificationsPage'))
const StaffConsole = lazy(() => import('@/features/staff/pages/StaffConsole'))
const CompetitionJudgingPage = lazy(() => import('@/features/staff/pages/CompetitionJudgingPage'))

const RouteLoader = () => <main role="status" className="min-h-[40vh] flex items-center justify-center bg-[var(--color-bg)] text-[13px] text-[var(--color-text-muted)]">Loading…</main>

export default function App() {
  const location = useLocation()
  const isServerUnavailable = useServerUnavailable()
  const notificationsOpen = location.pathname === '/notifications'
  const loggedIn = useSelector(state => Boolean(state.auth.user))
  const background = notificationsOpen && loggedIn ? location.state?.notificationBackground || { pathname: '/', search: '', hash: '' } : location
  const studioParams = new URLSearchParams(background.search || '')
  const studioEditorOpen = ['draft', 'edit', 'new', 'question'].some(key => studioParams.has(key))
  return (
    <LoginPromptProvider><Suspense fallback={<RouteLoader />}><Routes location={background}>
      {/* ── Public full-screen routes ── */}
      <Route path="/login"      element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup"     element={<PublicRoute><LoginPage signUp={true} /></PublicRoute>} />
      <Route path="/onboarding" element={<PrivateRoute message="Sign in to personalize your experience." fullScreen><OnboardingPage /></PrivateRoute>} />

      {/* ── App shell routes ── */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />

        {/* Explore — sub-tabs nested, index redirects to trending */}
        <Route path="/explore" element={<ExplorePage />}>
          <Route index element={<Navigate to="trending" replace />} />
          <Route path="trending"     element={<TrendingTab />} />
          <Route path="questions"    element={<QuestionsTab />} />
          <Route path="competitions" element={<CompetitionsTab />} />
        </Route>

        {/* Competition detail — standalone page within AppLayout */}
        <Route path="/explore/competitions/:id" element={<CompetitionDetail />} />
        <Route path="/explore/questions/:id" element={<QuestionDetail />} />
        <Route path="/opportunities" element={<PrivateRoute message="Sign in to view your writing opportunities."><OpportunitiesPage /></PrivateRoute>} />

        <Route path="/search"          element={<SearchPage />} />
        <Route path="/post/:id"        element={<PostPage />} />
        <Route path="/author"          element={<AuthorPage />} />
        <Route path="/author/:handle"  element={<AuthorPage />} />
        <Route path="/collections"     element={<CollectionsPage />} />
        <Route path="/saved"            element={<PrivateRoute message="Sign in to view your saved stories."><SavedPage /></PrivateRoute>} />
        <Route path="/collections/:id" element={<CollectionDetail />} />
        <Route path="/shorts"           element={<ShortsPage />} />
        <Route path="/series"           element={<SeriesPage />} />
        <Route path="/series/:id"       element={<ShortSeriesDetail />} />
        <Route path="/shorts/series/:id" element={<ShortSeriesDetail />} />
        <Route path="/history"          element={<PrivateRoute message="Sign in to view your reading history."><ReadingHistoryPage /></PrivateRoute>} />
        <Route path="/members"          element={<PrivateRoute message="Sign in to access members page."><MemberHub /></PrivateRoute>} />
        {!loggedIn && <Route path="/notifications" element={<PrivateRoute message="Sign in to view your notifications."><NotificationsPage /></PrivateRoute>} />}
        <Route path="/membership"       element={<MembershipPage />} />
        <Route path="/staff"            element={<PrivateRoute message="Sign in to access the staff console."><StaffConsole /></PrivateRoute>} />
        <Route path="/staff/competitions/:id/judging" element={<PrivateRoute message="Sign in to review competition scores."><CompetitionJudgingPage /></PrivateRoute>} />

        {/* ── Account and private routes ── */}
        <Route path="/write" element={<Navigate to={`/studio${location.search}${location.hash}`} replace />} />
        <Route path="/profile/edit" element={<PrivateRoute message="Sign in to edit your profile."><EditProfilePage /></PrivateRoute>} />
        <Route path="/profile"         element={<ProfilePage />} />
        <Route path="/writing" element={<Navigate to={`/studio${location.search}${location.hash}`} replace />} />
        <Route path="/studio" element={studioEditorOpen ? <WritePage /> : <PrivateRoute message="Sign in to manage your writing."><WritingPage /></PrivateRoute>} />
        <Route path="/settings"        element={<SettingsPage />} />
        <Route path="/help"            element={<HelpPage />} />

        {/* Redirects */}
        <Route path="*"        element={<NotFound />} />
      </Route>
    </Routes>{notificationsOpen && loggedIn && !isServerUnavailable && <Suspense fallback={null}><Routes>
      <Route path="/notifications" element={<PrivateRoute message="Sign in to view your notifications."><NotificationsPage /></PrivateRoute>} />
    </Routes></Suspense>}</Suspense></LoginPromptProvider>
  )
}
