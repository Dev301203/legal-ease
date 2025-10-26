import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import {
  Box,
  Button,
  Card,
  Collapsible,
  Container,
  Heading,
  HStack,
  Text,
  Textarea,
  VStack,
  Spinner,
} from "@chakra-ui/react"
import { Dialog } from "@chakra-ui/react"

interface CaseSearchParams {
  id?: string
}

export const Route = createFileRoute("/case")({
  validateSearch: (search: Record<string, unknown>): CaseSearchParams => ({
    id: (search.id as string) || undefined,
  }),
  component: CasePage,
})

interface Simulation {
  id: string
  headline: string
  brief: string
  created_at: Date
  node_count: number
}

interface CaseBackground {
  party_a: string
  party_b: string
  key_issues: string
  general_notes: string
}

interface CaseData {
  id: string
  name: string
  summary: string
  background: CaseBackground
  simulations: Simulation[]
}

function CasePage() {
  const navigate = useNavigate()
  const { id } = Route.useSearch()

  const [caseData, setCaseData] = useState<CaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isEditBackgroundOpen, setIsEditBackgroundOpen] = useState(false)
  const [editedBackground, setEditedBackground] = useState<CaseBackground>({
    party_a: "",
    party_b: "",
    key_issues: "",
    general_notes: "",
  })

  const [isNewSimulationOpen, setIsNewSimulationOpen] = useState(false)
  const [simulationBrief, setSimulationBrief] = useState("")

  // 🧭 Redirect if no case ID
  useEffect(() => {
    if (!id) navigate({ to: "/cases" })
  }, [id, navigate])

  // 🧠 Fetch case info from backend
useEffect(() => {
  if (!id) return

  const fetchCaseData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:8000/api/v1/cases/${id}`)
      if (!response.ok) throw new Error(`Failed to fetch case: ${response.status}`)

      const data = await response.json()

      // ✅ Parse simulations
      const simulations = data.simulations.map((sim: any) => ({
        id: String(sim.id),
        headline: sim.headline,
        brief: sim.brief,
        created_at: new Date(sim.createdAt),
        node_count: sim.nodeCount,
      }))

      // ✅ Parse and normalize background
      const rawBg = data.background
      const background = {
        party_a: rawBg.party_a || "",
        party_b: rawBg.party_b || "",
        key_issues: Array.isArray(rawBg.key_issues)
          ? rawBg.key_issues.map(issue => `• ${issue}`).join("\n")
          : rawBg.key_issues || "",
        general_notes: rawBg.general_notes || "",
      }

      // ✅ Store in state
      setCaseData({
        id: String(data.id),
        name: data.name,
        summary: data.summary,
        background,
        simulations,
      })
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Error loading case data")
    } finally {
      setLoading(false)
    }
  }

  fetchCaseData()
}, [id])


  const handleEditBackground = () => {
    if (caseData) setEditedBackground(caseData.background)
    setIsEditBackgroundOpen(true)
  }

  const handleSaveBackground = () => {
    // TODO: Save background changes to backend
    setIsEditBackgroundOpen(false)
  }

  const handleCancelBackground = () => setIsEditBackgroundOpen(false)

  const handleNewSimulation = () => {
    setSimulationBrief("")
    setIsNewSimulationOpen(true)
  }

  const handleGenerateSimulation = () => {
    if (simulationBrief.trim()) {
      // TODO: Generate simulation via backend
      // For now, create mock simulation and navigate
      // Navigate to root node of the new simulation
      const newSimulationId = `sim-${Date.now()}`
      const rootNodeId = `${newSimulationId}-root`
      setIsNewSimulationOpen(false)
      navigate({ to: "/scenario", search: { id: rootNodeId } })
    }
  }

  const handleCancelSimulation = () => {
    setIsNewSimulationOpen(false)
    setSimulationBrief("")
  }

  if (loading) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" color="#3A3A3A" />
      </Box>
    )
  }

  if (error || !caseData) {
    return (
      <Box minHeight="100vh" display="flex" flexDir="column" alignItems="center" justifyContent="center">
        <Text color="red.500" fontSize="lg">
          {error || "Case not found"}
        </Text>
        <Button mt={4} onClick={() => navigate({ to: "/cases" })}>
          Back to Cases
        </Button>
      </Box>
    )
  }

  return (
    <Box minHeight="100vh" bg="#F4ECD8" py={8}>
      <Container maxW="1200px">
        {/* Back Button */}
        <Box mb={4}>
          <Text
            as="button"
            onClick={() => navigate({ to: "/cases" })}
            color="#3A3A3A"
            fontSize="sm"
            _hover={{ textDecoration: "underline" }}
          >
            ← Back to Cases
          </Text>
        </Box>

        {/* Case Title */}
        <Heading fontSize="3xl" fontWeight="semibold" color="#3A3A3A" mb={6}>
          {caseData.name}
        </Heading>

        {/* About the Case Section */}
        <VStack alignItems="flex-start" gap={6} mb={8}>
          <Heading fontSize="2xl" color="#3A3A3A">
            About the Case
          </Heading>

          {/* Summary */}
          <Card.Root width="100%" bg="white">
            <Card.Body>
              <VStack alignItems="flex-start" gap={3}>
                <Heading fontSize="lg" color="#3A3A3A">
                  Summary
                </Heading>
                <Text fontSize="md" color="#666" lineHeight="1.6">
                  {caseData.summary}
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Background - Collapsible */}
          <Card.Root width="100%" bg="white">
            <Collapsible.Root>
              <Card.Body>
                <HStack justifyContent="space-between" width="100%" mb={2}>
                  <Collapsible.Trigger paddingY={2} flex={1}>
                    <HStack justifyContent="space-between" width="100%">
                      <Heading fontSize="lg" color="#3A3A3A">
                        Background
                      </Heading>
                      <Text fontSize="sm" color="#999">
                        ▼
                      </Text>
                    </HStack>
                  </Collapsible.Trigger>
                  <Button size="sm" variant="outline" onClick={handleEditBackground}>
                    Edit Background
                  </Button>
                </HStack>

                <Collapsible.Content>
                  <VStack alignItems="flex-start" gap={4} width="100%" mt={4}>
                    <Box width="100%">
                      <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                        Party A (Our Client)
                      </Text>
                      <Textarea value={caseData.background.party_a} readOnly rows={2} bg="gray.50" borderColor="gray.200" />
                    </Box>

                    <Box width="100%">
                      <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                        Party B (Opposing Party)
                      </Text>
                      <Textarea value={caseData.background.party_b} readOnly rows={2} bg="gray.50" borderColor="gray.200" />
                    </Box>

                    <Box width="100%">
                      <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                        Key Issues
                      </Text>
                      <Textarea value={caseData.background.key_issues} readOnly bg="gray.50" borderColor="gray.200" />
                    </Box>

                    <Box width="100%">
                      <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                        General Notes
                      </Text>
                      <Textarea value={caseData.background.general_notes} readOnly rows={3} bg="gray.50" borderColor="gray.200" />
                    </Box>
                  </VStack>
                </Collapsible.Content>
              </Card.Body>
            </Collapsible.Root>
          </Card.Root>
        </VStack>

        {/* Simulations */}
        <VStack alignItems="flex-start" gap={6}>
          <HStack justifyContent="space-between" width="100%">
            <Heading fontSize="2xl" color="#3A3A3A">
              Simulations
            </Heading>
            <Button size="sm" variant="outline" onClick={handleNewSimulation}>
              New Simulation
            </Button>
          </HStack>

          <VStack width="100%" gap={4}>
            {caseData.simulations.map((simulation) => (
              <Card.Root
                key={simulation.id}
                width="100%"
                bg="white"
                cursor="pointer"
                _hover={{ shadow: "md" }}
                transition="all 0.2s"
                onClick={() =>
                  navigate({ to: "/scenario", search: { id: `${simulation.id}-root` } })
                }
              >
                <Card.Body>
                  <VStack alignItems="flex-start" gap={3}>
                    <Text fontSize="md" fontWeight="medium" color="#3A3A3A">
                      {simulation.headline}
                    </Text>

                    <HStack gap={6} fontSize="sm" color="#999">
                      <Text>
                        Created:{" "}
                        {simulation.created_at.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                      <Text>{simulation.node_count} nodes</Text>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            ))}
          </VStack>
        </VStack>
      </Container>

      {/* Edit Background Dialog */}
      <Dialog.Root open={isEditBackgroundOpen} onOpenChange={(e) => setIsEditBackgroundOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px">
            <Dialog.Header>
              <Dialog.Title>Edit Background</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} alignItems="flex-start" width="100%">
                {["party_a", "party_b", "key_issues", "general_notes"].map((field) => (
                  <Box width="100%" key={field}>
                    <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                      {field.replace("_", " ").toUpperCase()}
                    </Text>
                    <Textarea
                      value={(editedBackground as any)[field]}
                      onChange={(e) =>
                        setEditedBackground({
                          ...editedBackground,
                          [field]: e.target.value,
                        })
                      }
                      rows={field === "general_notes" ? 4 : 2}
                    />
                  </Box>
                ))}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" onClick={handleCancelBackground}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button bg="#3A3A3A" color="#F4ECD8" _hover={{ bg: "#2A2A2A" }} onClick={handleSaveBackground}>
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* New Simulation Dialog */}
      <Dialog.Root open={isNewSimulationOpen} onOpenChange={(e) => setIsNewSimulationOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px">
            <Dialog.Header>
              <Dialog.Title>Simulation Brief</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} alignItems="flex-start" width="100%">
                <Box width="100%">
                  <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                    Describe the simulation scenario
                  </Text>
                  <Textarea
                    value={simulationBrief}
                    onChange={(e) => setSimulationBrief(e.target.value)}
                    rows={6}
                    placeholder="Example: Simulate a negotiation about the matrimonial home."
                    autoFocus
                  />
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" onClick={handleCancelSimulation}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button
                bg="#3A3A3A"
                color="#F4ECD8"
                _hover={{ bg: "#2A2A2A" }}
                onClick={handleGenerateSimulation}
                disabled={!simulationBrief.trim()}
              >
                Generate
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  )
}

export default CasePage


