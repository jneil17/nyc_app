import { createFileRoute } from '@tanstack/react-router'
import RegistrationFlow from '../components/Registration/RegistrationFlow'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return <RegistrationFlow />
}
