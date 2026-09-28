import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { Spinner } from '@/components/ui'

/** Route-level code splitting keeps the first paint small (§43). */
const Home = lazy(() => import('@/pages/public/Home'))
const Disciplines = lazy(() => import('@/pages/public/Disciplines'))
const DisciplineDetail = lazy(() => import('@/pages/public/DisciplineDetail'))
const Rankings = lazy(() => import('@/pages/public/Rankings'))
const Results = lazy(() => import('@/pages/public/Results'))
const FighterId = lazy(() => import('@/pages/public/FighterId'))
const CreateId = lazy(() => import('@/pages/public/CreateId'))
const About = lazy(() => import('@/pages/public/About'))
const Partners = lazy(() => import('@/pages/public/Partners'))
const PoundForPound = lazy(() => import('@/pages/public/PoundForPound'))
const Fighters = lazy(() => import('@/pages/public/Fighters'))
const FighterProfile = lazy(() => import('@/pages/public/FighterProfile'))
const Events = lazy(() => import('@/pages/public/Events'))
const EventDetail = lazy(() => import('@/pages/public/EventDetail'))
const Compare = lazy(() => import('@/pages/public/Compare'))
const Movers = lazy(() => import('@/pages/public/Movers'))
const Methodology = lazy(() => import('@/pages/public/Methodology'))
const NotFound = lazy(() => import('@/pages/public/NotFound'))

const AdminLogin = lazy(() => import('@/pages/admin/Login'))
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminFights = lazy(() => import('@/pages/admin/Fights'))
const AdminFightForm = lazy(() => import('@/pages/admin/FightForm'))
const AdminEvents = lazy(() => import('@/pages/admin/Events'))
const AdminEventForm = lazy(() => import('@/pages/admin/EventForm'))
const AdminFighters = lazy(() => import('@/pages/admin/Fighters'))
const AdminFighterForm = lazy(() => import('@/pages/admin/FighterForm'))
const AdminApplications = lazy(() => import('@/pages/admin/Applications'))
const AdminDisciplines = lazy(() => import('@/pages/admin/Disciplines'))
const AdminDivisions = lazy(() => import('@/pages/admin/Divisions'))
const AdminSimulator = lazy(() => import('@/pages/admin/Simulator'))
const AdminRankingSettings = lazy(() => import('@/pages/admin/RankingSettings'))
const AdminChanges = lazy(() => import('@/pages/admin/RankingChanges'))
const AdminAudit = lazy(() => import('@/pages/admin/AuditLog'))
const AdminUsers = lazy(() => import('@/pages/admin/Users'))

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="disciplines" element={<Disciplines />} />
          <Route path="disciplines/:disciplineSlug" element={<DisciplineDetail />} />
          <Route path="rankings" element={<Rankings />} />
          <Route path="rankings/:divisionSlug" element={<Rankings />} />
          <Route path="p4p" element={<PoundForPound />} />
          <Route path="fighters" element={<Fighters />} />
          <Route path="fighters/:fighterId" element={<FighterProfile />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:eventSlug" element={<EventDetail />} />
          <Route path="compare" element={<Compare />} />
          <Route path="results" element={<Results />} />
          <Route path="fighter-id" element={<FighterId />} />
          <Route path="fighter-id/new" element={<CreateId />} />
          <Route path="movers" element={<Movers />} />
          <Route path="about" element={<About />} />
          <Route path="partners" element={<Partners />} />
          <Route path="methodology" element={<Methodology />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="fights" element={<AdminFights />} />
          <Route path="fights/new" element={<AdminFightForm />} />
          <Route path="fights/:fightId" element={<AdminFightForm />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="events/new" element={<AdminEventForm />} />
          <Route path="events/:eventId" element={<AdminEventForm />} />
          <Route path="fighters" element={<AdminFighters />} />
          <Route path="fighters/new" element={<AdminFighterForm />} />
          <Route path="fighters/:fighterId" element={<AdminFighterForm />} />
          <Route path="applications" element={<AdminApplications />} />
          <Route path="disciplines" element={<AdminDisciplines />} />
          <Route path="divisions" element={<AdminDivisions />} />
          <Route path="simulator" element={<AdminSimulator />} />
          <Route path="ranking-settings" element={<AdminRankingSettings />} />
          <Route path="changes" element={<AdminChanges />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
