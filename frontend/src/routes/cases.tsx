import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Box,
  Button,
  Card,
  Container,
  Heading,
  Icon,
  IconButton,
  Input,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Dialog } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { FiX, FiTrash2 } from "react-icons/fi"
import { DefaultService } from "../client"
import { toaster } from "@/components/ui/toaster"


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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null)

  const [cases, setCases] = useState<Case[]>([])




    useEffect(() => {
    DefaultService.getAllCases()
      .then((data: any) => {
        const cases = data.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          last_modified: new Date(c.last_modified),
          scenario_count: c.scenario_count || 0,
        }))
        setCases(cases)
      })
      .catch((err) => console.error("Failed to fetch cases:", err))
  }, [])

  const handleNewCase = () => setIsNewCaseModalOpen(true)



  const handleCreateCase = async () => {
    if (newCaseTitle.trim()) {
      try {
        const newCase = await DefaultService.createCase({
          requestBody: {
            name: newCaseTitle,
            party_a: "",
            party_b: "",
            context: null,
          },
        })

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

  const handleDeleteClick = (e: React.MouseEvent, caseItem: Case) => {
    e.stopPropagation() // Prevent card click navigation
    setCaseToDelete(caseItem)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!caseToDelete) return

    try {
      await DefaultService.deleteCase({ caseId: Number(caseToDelete.id) })

      // Remove from local state
      setCases(cases.filter(c => c.id !== caseToDelete.id))

      toaster.create({
        title: "Case deleted",
        description: `"${caseToDelete.name}" has been deleted successfully.`,
        type: "success",
      })
    } catch (error) {
      console.error("Error deleting case:", error)
      toaster.create({
        title: "Error",
        description: "Failed to delete case. Please try again.",
        type: "error",
      })
    } finally {
      setIsDeleteDialogOpen(false)
      setCaseToDelete(null)
    }
  }

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false)
    setCaseToDelete(null)
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
              position="relative"
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

                  <IconButton
                    aria-label="Delete case"
                    size="sm"
                    variant="ghost"
                    position="absolute"
                    bottom={2}
                    right={2}
                    onClick={(e) => handleDeleteClick(e, caseItem)}
                    _hover={{ bg: "red.50", color: "red.600" }}
                  >
                    <FiTrash2 />
                  </IconButton>
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

      {/* Delete Confirmation Dialog */}
      <Dialog.Root
        open={isDeleteDialogOpen}
        onOpenChange={(e) => setIsDeleteDialogOpen(e.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Delete Case</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelDelete}
                  position="absolute"
                  top={4}
                  right={4}
                >
                  <Icon as={FiX} />
                </Button>
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                Are you sure you want to delete "{caseToDelete?.name}"? This will also delete all associated simulations, messages, and documents. This action cannot be undone.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                bg="red.600"
                color="white"
                _hover={{ bg: "red.700" }}
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  )
}
