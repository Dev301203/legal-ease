import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Box,
  Button,
  Card,
  Container,
  Heading,
  Icon,
  Input,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Dialog } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { FiX } from "react-icons/fi"


export const Route = createFileRoute("/cases")({
  component: CasesPage,
})

interface Case {
  id: string
  name: string
  last_modified: Date
  scenario_count: number
}

function CasesPage() {
  const navigate = useNavigate()
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false)
  const [newCaseTitle, setNewCaseTitle] = useState("")

  const [cases, setCases] = useState<Case[]>([])




    useEffect(() => {
    fetch("http://localhost:8000/api/v1/cases") // adjust base URL if needed
      .then((res) => res.json())
      .then((data: Case[]) => setCases(data))
      .catch((err) => console.error("Failed to fetch cases:", err))
  }, [])

  const handleNewCase = () => setIsNewCaseModalOpen(true)



  const handleCreateCase = async () => {
    if (newCaseTitle.trim()) {
      try {
        const response = await fetch("http://localhost:8000/api/v1/cases", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newCaseTitle,
            summary: "",
            party_a: "",
            party_b: "",
            context: null,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to create case")
        }

        const newCase = await response.json()

        // Add to local state
        setCases([...cases, {
          id: String(newCase.id),
          name: newCase.name,
          last_modified: new Date(newCase.last_modified),
          scenario_count: newCase.scenario_count,
        }])

        setIsNewCaseModalOpen(false)
        setNewCaseTitle("")

        // Navigate to the new case
        navigate({ to: "/case", search: { id: String(newCase.id) } })
      } catch (error) {
        console.error("Error creating case:", error)
        alert("Failed to create case. Please try again.")
      }
    }
  }

  const handleCancelNewCase = () => {
    setIsNewCaseModalOpen(false)
    setNewCaseTitle("")
  }

  const handleCaseClick = (caseId: string) => {
    navigate({ to: "/case", search: { id: caseId } })
  }

  return (
    <Box minHeight="100vh" bg="#F4ECD8" py={8}>
      <Container maxW="1200px">
        <Heading
          fontSize="4xl"
          fontWeight="semibold"
          color="#3A3A3A"
          mb={8}
        >
          Case Library
        </Heading>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
          {/* Existing Cases */}
          {cases.map((caseItem) => (
            <Card.Root
              key={caseItem.id}
              cursor="pointer"
              onClick={() => handleCaseClick(caseItem.id)}
              _hover={{ transform: "scale(1.02)", shadow: "lg" }}
              transition="all 0.2s"
              bg="white"
            >
              <Card.Body>
                <VStack alignItems="flex-start" gap={4} height="200px">
                  <Heading
                    fontSize="xl"
                    color="#3A3A3A"
                    lineClamp={2}
                    overflow="hidden"
                  >
                    {caseItem.name}
                  </Heading>

                  <VStack alignItems="flex-start" gap={2} flex={1}>
                    <Text fontSize="med" color="#666">
                      Last modified:{" "}
                      {new Date(caseItem.last_modified).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                    <Text fontSize="med" color="#666">
                      {caseItem.scenario_count}{" "}
                      {caseItem.scenario_count === 1
                        ? "simulation"
                        : "simulations"}
                    </Text>
                  </VStack>
                </VStack>
              </Card.Body>
            </Card.Root>
          ))}
          {/* New Case Card */}
          <Card.Root
            cursor="pointer"
            onClick={handleNewCase}
            _hover={{ transform: "scale(1.02)", shadow: "lg" }}
            transition="all 0.2s"
            bg="transparent"
            borderWidth="2px"
            borderStyle="dashed"
            borderColor="#D3D3D3"
          >
            <Card.Body>
              <VStack
                height="200px"
                justifyContent="center"
                alignItems="center"
              >
                <Text fontSize="6xl" color="#3A3A3A">
                 +
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>
      </Container>

      {/* New Case Modal */}
      <Dialog.Root
        open={isNewCaseModalOpen}
        onOpenChange={(e) => setIsNewCaseModalOpen(e.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Create New Case</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelNewCase}
                  position="absolute"
                  top={4}
                  right={4}
                >
                  <Icon as={FiX} />
                </Button>
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} alignItems="flex-start" width="100%">
                <Box width="100%">
                  <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                    Case Title
                  </Text>
                  <Input
                    value={newCaseTitle}
                    onChange={(e) => setNewCaseTitle(e.target.value)}
                    placeholder="e.g., Sterling v. Sterling"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateCase()
                      if (e.key === "Escape") handleCancelNewCase()
                    }}
                  />
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                bg="#3A3A3A"
                color="#F4ECD8"
                _hover={{ bg: "#2A2A2A" }}
                onClick={handleCreateCase}
                disabled={!newCaseTitle.trim()}
              >
                Create Case
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  )
}
