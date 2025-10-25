import { createFileRoute } from "@tanstack/react-router"
import { Container, Heading } from "@chakra-ui/react"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <Container maxW="container.xl" py={8}>
      <Heading size="2xl">Hello, World</Heading>
    </Container>
  )
}
