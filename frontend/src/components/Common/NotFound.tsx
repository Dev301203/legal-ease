import { Button, Center, Flex, Image, Text } from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"

const NotFound = () => {
  return (
    <Flex
      height="100vh"
      align="center"
      justify="center"
      flexDir="column"
      data-testid="not-found"
      p={4}
      position="relative"
    >
      <Image
        src="/assets/images/spilled-ink.png"
        alt="Spilled ink"
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-20%, -30%)"
        opacity={0.3}
        mixBlendMode="multiply"
        zIndex={0}
        w="80%"
        maxW="600px"
      />
      <Flex alignItems="center" zIndex={1}>
        <Flex flexDir="column" ml={4} align="center" justify="center" p={4}>
          <Text
            fontSize={{ base: "6xl", md: "8xl" }}
            fontWeight="bold"
            lineHeight="1"
            mb={4}
          >
            404
          </Text>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            Oops!
          </Text>
        </Flex>
      </Flex>

      <Text fontSize="lg" color="gray.600" mb={4} textAlign="center" zIndex={1}>
        The page you are looking for was not found.
      </Text>
      <Center zIndex={1}>
        <Link to="/">
          <Button variant="solid" colorScheme="teal" mt={4} alignSelf="center">
            Go Back
          </Button>
        </Link>
      </Center>
    </Flex>
  )
}

export default NotFound
