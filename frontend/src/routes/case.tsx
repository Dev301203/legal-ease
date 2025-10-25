import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import {
  Box,
  Button,
  Card,
  Collapsible,
  Container,
  Heading,
  HStack,
  Input,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { Dialog } from "@chakra-ui/react"

interface CaseSearchParams {
  id?: string
}

export const Route = createFileRoute("/case")({
  validateSearch: (search: Record<string, unknown>): CaseSearchParams => {
    return {
      id: (search.id as string) || undefined,
    }
  },
  component: CasePage,
})

interface Simulation {
  id: string
  headline: string
  brief: string
  createdAt: Date
  nodeCount: number
}

interface CaseBackground {
  partyA: string
  partyB: string
  keyIssues: string
  generalNotes: string
}

interface CaseData {
  id: string
  title: string
  summary: string
  background: CaseBackground
  simulations: Simulation[]
}

// Mock data for now
const mockCases: Record<string, CaseData> = {
  "1": {
    id: "1",
    title: "Smith v. Johnson Contract Dispute",
    summary:
      "This case involves a breach of contract dispute between Smith and Johnson regarding a commercial real estate transaction. The plaintiff alleges failure to deliver the property as agreed, while the defendant claims material misrepresentation. Key issues include interpretation of contract terms, damages calculation, and potential rescission remedies.",
    background: {
      partyA: "Plaintiff: John Smith - Commercial real estate developer, claims breach of contract",
      partyB: "Defendant: Michael Johnson - Property owner, claims material misrepresentation by plaintiff",
      keyIssues: "Contract interpretation, undisclosed structural issues, proof of funds, damages calculation",
      generalNotes: "Contract value: $2,500,000. Property: 5,000 sq ft commercial at 123 Main Street. Closing date: June 1, 2024.",
    },
    simulations: [
      {
        id: "st1",
        headline: "Mediation Session Simulation",
        brief: "Let's simulate a mediation session between the parties",
        createdAt: new Date("2025-10-18"),
        nodeCount: 12,
      },
      {
        id: "st2",
        headline: "Settlement Negotiation",
        brief: "Explore settlement negotiation strategies",
        createdAt: new Date("2025-10-19"),
        nodeCount: 8,
      },
      {
        id: "st3",
        headline: "Trial Outcome Analysis",
        brief: "Analyze potential court outcomes if case goes to trial",
        createdAt: new Date("2025-10-20"),
        nodeCount: 15,
      },
    ],
  },
  "2": {
    id: "2",
    title: "Estate Planning - Anderson Family",
    summary:
      "Comprehensive estate planning matter for the Anderson family involving multi-generational wealth transfer. The case addresses trust formation, tax optimization strategies, and healthcare directives. Special considerations include business succession planning and charitable giving structures.",
    background: {
      partyA: "Robert Anderson (age 68) and Margaret Anderson (age 65) - Primary estate holders",
      partyB: "Three adult children: Sarah (40), David (38), Emily (35) - Beneficiaries",
      keyIssues: "Estate tax minimization, business succession, equal treatment, charitable foundation",
      generalNotes: "Total assets: $40M (Family business $15M, Properties $8M, Investments $12M, Retirement $5M)",
    },
    simulations: [
      {
        id: "st4",
        headline: "Trust Distribution Models",
        brief: "Model different trust distribution scenarios",
        createdAt: new Date("2025-10-16"),
        nodeCount: 10,
      },
      {
        id: "st5",
        headline: "Family Inheritance Discussion",
        brief: "Simulate family discussions about inheritance",
        createdAt: new Date("2025-10-17"),
        nodeCount: 7,
      },
    ],
  },
  "3": {
    id: "3",
    title: "Corporate Merger - TechCorp Inc.",
    summary:
      "Due diligence and negotiation phase of TechCorp's acquisition by a larger competitor. Issues include valuation disputes, retention of key employees, IP portfolio assessment, and regulatory approval requirements. The deal structure involves both stock and cash components.",
    background: {
      partyA: "TechCorp Inc. - Target company (500 employees, $50M revenue)",
      partyB: "GlobalTech Solutions - Acquiring company (5000 employees, $2B revenue)",
      keyIssues: "Employee retention, IP ownership (3 key patents), FTC approval, tech stack integration",
      generalNotes: "Deal: $75M cash + $25M stock with earnout provisions based on 2-year revenue targets",
    },
    simulations: [
      {
        id: "st6",
        headline: "Valuation Negotiation",
        brief: "Negotiate deal valuation and earnout structure",
        createdAt: new Date("2025-10-14"),
        nodeCount: 18,
      },
      {
        id: "st7",
        headline: "Regulatory Approval Strategy",
        brief: "Explore regulatory approval strategy",
        createdAt: new Date("2025-10-15"),
        nodeCount: 9,
      },
    ],
  },
}

function CasePage() {
  const navigate = useNavigate()
  const { id } = Route.useSearch()
  const [isEditBackgroundOpen, setIsEditBackgroundOpen] = useState(false)
  const [editedBackground, setEditedBackground] = useState<CaseBackground>({
    partyA: "",
    partyB: "",
    keyIssues: "",
    generalNotes: "",
  })
  const [isNewSimulationOpen, setIsNewSimulationOpen] = useState(false)
  const [simulationBrief, setSimulationBrief] = useState("")

  // If no case ID, redirect to cases list
  if (!id) {
    navigate({ to: "/cases" })
    return null
  }

  const caseData = mockCases[id]

  // If case not found, redirect to cases list
  if (!caseData) {
    navigate({ to: "/cases" })
    return null
  }

  const handleEditBackground = () => {
    setEditedBackground(caseData.background)
    setIsEditBackgroundOpen(true)
  }

  const handleSaveBackground = () => {
    // TODO: Save background to backend/state
    setIsEditBackgroundOpen(false)
  }

  const handleCancelBackground = () => {
    setIsEditBackgroundOpen(false)
  }

  const handleNewSimulation = () => {
    setSimulationBrief("")
    setIsNewSimulationOpen(true)
  }

  const handleGenerateSimulation = () => {
    if (simulationBrief.trim()) {
      // TODO: Generate simulation via backend
      // For now, create mock simulation and navigate
      const newSimulationId = `sim-${Date.now()}`
      setIsNewSimulationOpen(false)
      navigate({ to: "/simulation", search: { id: newSimulationId } })
    }
  }

  const handleCancelSimulation = () => {
    setIsNewSimulationOpen(false)
    setSimulationBrief("")
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
          {caseData.title}
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEditBackground}
                  >
                    Edit Background
                  </Button>
                </HStack>

                <Collapsible.Content>
                  <VStack alignItems="flex-start" gap={4} width="100%" mt={4}>
                    <Box width="100%">
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color="#3A3A3A"
                        mb={2}
                      >
                        Party A (Our Client)
                      </Text>
                      <Textarea
                        value={caseData.background.partyA}
                        readOnly
                        rows={2}
                        bg="gray.50"
                        borderColor="gray.200"
                      />
                    </Box>

                    <Box width="100%">
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color="#3A3A3A"
                        mb={2}
                      >
                        Party B (Opposing Party)
                      </Text>
                      <Textarea
                        value={caseData.background.partyB}
                        readOnly
                        rows={2}
                        bg="gray.50"
                        borderColor="gray.200"
                      />
                    </Box>

                    <Box width="100%">
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color="#3A3A3A"
                        mb={2}
                      >
                        Key Issues
                      </Text>
                      <Input
                        value={caseData.background.keyIssues}
                        readOnly
                        bg="gray.50"
                        borderColor="gray.200"
                      />
                    </Box>

                    <Box width="100%">
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color="#3A3A3A"
                        mb={2}
                      >
                        General Notes
                      </Text>
                      <Textarea
                        value={caseData.background.generalNotes}
                        readOnly
                        rows={3}
                        bg="gray.50"
                        borderColor="gray.200"
                      />
                    </Box>
                  </VStack>
                </Collapsible.Content>
              </Card.Body>
            </Collapsible.Root>
          </Card.Root>
        </VStack>

        {/* Simulations Section */}
        <VStack alignItems="flex-start" gap={6}>
          <HStack justifyContent="space-between" width="100%">
            <Heading fontSize="2xl" color="#3A3A3A">
              Simulations
            </Heading>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNewSimulation}
            >
              New Simulation
            </Button>
          </HStack>

          {/* Simulation Cards */}
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
                  navigate({ to: "/simulation", search: { id: simulation.id } })
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
                        {simulation.createdAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                      <Text>{simulation.nodeCount} nodes</Text>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            ))}
          </VStack>
        </VStack>
      </Container>

      {/* Edit Background Modal */}
      <Dialog.Root
        open={isEditBackgroundOpen}
        onOpenChange={(e) => setIsEditBackgroundOpen(e.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px">
            <Dialog.Header>
              <Dialog.Title>Edit Background</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} alignItems="flex-start" width="100%">
                <Box width="100%">
                  <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                    Party A (Our Client)
                  </Text>
                  <Textarea
                    value={editedBackground.partyA}
                    onChange={(e) =>
                      setEditedBackground({
                        ...editedBackground,
                        partyA: e.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Describe your client and their position..."
                  />
                </Box>

                <Box width="100%">
                  <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                    Party B (Opposing Party)
                  </Text>
                  <Textarea
                    value={editedBackground.partyB}
                    onChange={(e) =>
                      setEditedBackground({
                        ...editedBackground,
                        partyB: e.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Describe the opposing party and their position..."
                  />
                </Box>

                <Box width="100%">
                  <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                    Key Issues
                  </Text>
                  <Input
                    value={editedBackground.keyIssues}
                    onChange={(e) =>
                      setEditedBackground({
                        ...editedBackground,
                        keyIssues: e.target.value,
                      })
                    }
                    placeholder="e.g., Property division, custody arrangements..."
                  />
                </Box>

                <Box width="100%">
                  <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                    General Notes
                  </Text>
                  <Textarea
                    value={editedBackground.generalNotes}
                    onChange={(e) =>
                      setEditedBackground({
                        ...editedBackground,
                        generalNotes: e.target.value,
                      })
                    }
                    rows={4}
                    placeholder="Additional context, important dates, financial details..."
                  />
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline" onClick={handleCancelBackground}>
                  Cancel
                </Button>
              </Dialog.CloseTrigger>
              <Button
                bg="#3A3A3A"
                color="#F4ECD8"
                _hover={{ bg: "#2A2A2A" }}
                onClick={handleSaveBackground}
              >
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* New Simulation Brief Modal */}
      <Dialog.Root
        open={isNewSimulationOpen}
        onOpenChange={(e) => setIsNewSimulationOpen(e.open)}
      >
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
                    placeholder="Example: Simulate a negotiation about the matrimonial home. Mr. Sterling's counsel (Party B) makes the opening statement."
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
