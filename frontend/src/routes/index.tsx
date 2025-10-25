import { createFileRoute } from "@tanstack/react-router"
import { Box, Button, Heading, VStack } from "@chakra-ui/react"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      height="100vh"
      width="100%"
    >
      <VStack gap={8}>
        <Heading
          fontSize="8xl"
          fontWeight="semibold"
          color="#3A3A3A"
          letterSpacing="tight"
          paddingBottom="40px"
        >
          LegalEase
        </Heading>
        <Button
          size="2xl"
          px={12}
          py={8}
          fontSize="3xl"
          fontWeight="semibold"
          bg="#3A3A3A"
          color="#F4ECD8"
          _hover={{ bg: "#2A2A2A" }}
          _active={{ bg: "#1A1A1A" }}
        >
          Start
        </Button>
      </VStack>
    </Box>
  )
}
