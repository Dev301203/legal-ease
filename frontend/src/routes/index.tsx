import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Box, Button, Heading, Image, VStack } from "@chakra-ui/react"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate()
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      height="100vh"
      width="100%"
      position="relative"
      overflow="hidden"
    >
      <Image
        src="/assets/images/ink-bg-1.jpg"
        alt="Ink background"
        position="absolute"
        right="0"
        height="100%"
        width="auto"
        objectFit="cover"
        opacity={0.2}
        mixBlendMode="multiply"
      />
      <Box
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, -50%)"
        height="80vh"
        width="80vh"
        bg="#F4ECD8"
        borderRadius="50%"
        zIndex={0}
        filter="blur(90px)"
        opacity={0.8}
      />
      <VStack gap={8} zIndex={1}>
        <Image
          src="/assets/images/logo.png"
          alt="LegalEase Logo"
          maxWidth="200px"
          marginBottom="10px"
        />
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
          onClick={() => navigate({ to: "/cases" })}
        >
          Start
        </Button>
      </VStack>
    </Box>
  )
}
