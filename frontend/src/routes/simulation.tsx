import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import {
  Box,
  Button,
  Card,
  Container,
  Heading,
  HStack,
  Input,
  Spinner,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { Dialog } from "@chakra-ui/react"
import { toaster } from "@/components/ui/toaster"
import { FiSave, FiMic, FiEye, FiPlay } from "react-icons/fi"

interface SimulationSearchParams {
  id?: string
}

export const Route = createFileRoute("/simulation")({
  validateSearch: (
    search: Record<string, unknown>,
  ): SimulationSearchParams => {
    return {
      id: (search.id as string) || undefined,
    }
  },
  component: SimulationPage,
})

interface Simulation {
  id: string
  headline: string
  brief: string
  createdAt: Date
  nodeCount: number
  caseId: string
  caseTitle: string
}

// Dialogue tree node types
type Party = "A" | "B"

interface DialogueNode {
  id: string
  statement: string
  party: Party
  children: DialogueNode[]
}

interface ResponseOption {
  id: string
  text: string
}

// Mock data for now
const mockSimulations: Record<string, Simulation> = {
  st1: {
    id: "st1",
    headline: "Mediation Session Simulation",
    brief: "Let's simulate a mediation session between the parties",
    createdAt: new Date("2025-10-18"),
    nodeCount: 12,
    caseId: "1",
    caseTitle: "Smith v. Johnson Contract Dispute",
  },
  st2: {
    id: "st2",
    headline: "Settlement Negotiation",
    brief: "Explore settlement negotiation strategies",
    createdAt: new Date("2025-10-19"),
    nodeCount: 8,
    caseId: "1",
    caseTitle: "Smith v. Johnson Contract Dispute",
  },
  st3: {
    id: "st3",
    headline: "Trial Outcome Analysis",
    brief: "Analyze potential court outcomes if case goes to trial",
    createdAt: new Date("2025-10-20"),
    nodeCount: 15,
    caseId: "1",
    caseTitle: "Smith v. Johnson Contract Dispute",
  },
  st4: {
    id: "st4",
    headline: "Trust Distribution Models",
    brief: "Model different trust distribution scenarios",
    createdAt: new Date("2025-10-16"),
    nodeCount: 10,
    caseId: "2",
    caseTitle: "Estate Planning - Anderson Family",
  },
  st5: {
    id: "st5",
    headline: "Family Inheritance Discussion",
    brief: "Simulate family discussions about inheritance",
    createdAt: new Date("2025-10-17"),
    nodeCount: 7,
    caseId: "2",
    caseTitle: "Estate Planning - Anderson Family",
  },
  st6: {
    id: "st6",
    headline: "Valuation Negotiation",
    brief: "Negotiate deal valuation and earnout structure",
    createdAt: new Date("2025-10-14"),
    nodeCount: 18,
    caseId: "3",
    caseTitle: "Corporate Merger - TechCorp Inc.",
  },
  st7: {
    id: "st7",
    headline: "Regulatory Approval Strategy",
    brief: "Explore regulatory approval strategy",
    createdAt: new Date("2025-10-15"),
    nodeCount: 9,
    caseId: "3",
    caseTitle: "Corporate Merger - TechCorp Inc.",
  },
}

// Initial dialogue tree with opening statement
const createInitialDialogueTree = (): DialogueNode => ({
  id: "root",
  statement:
    "Anna, good to speak. My client has run the numbers, and the most logical step is to sell the home and split the equity. He proposes a 50/50 division.",
  party: "B",
  children: [],
})

// Mock LLM responses for different user inputs
const getMockResponses = (userInput: string): ResponseOption[] => {
  // For demonstration, return contextual responses
  if (userInput.toLowerCase().includes("nesting")) {
    return [
      {
        id: "r1",
        text: "A 'nesting arrangement' is financially unworkable. Let's be realistic.",
      },
      {
        id: "r2",
        text: "My client is willing to discuss that, provided he has buyout options for her share.",
      },
      {
        id: "r3",
        text: "Let's park the home and confirm the spousal support figures first.",
      },
    ]
  } else if (userInput.toLowerCase().includes("stability")) {
    return [
      {
        id: "r1",
        text: "We understand the concern, but we need a concrete proposal for the property.",
      },
      {
        id: "r2",
        text: "Perhaps we can explore a delayed sale with your client retaining occupancy for 12 months?",
      },
      {
        id: "r3",
        text: "What if we discuss a structured buyout over time instead?",
      },
    ]
  } else {
    return [
      {
        id: "r1",
        text: "I understand your position. What alternative arrangement would your client prefer?",
      },
      {
        id: "r2",
        text: "That's a significant departure from our proposal. Can you provide more details?",
      },
      {
        id: "r3",
        text: "Let me discuss this with my client and get back to you with options.",
      },
    ]
  }
}

function SimulationPage() {
  const navigate = useNavigate()
  const { id } = Route.useSearch()

  // State management
  const [dialogueTree, setDialogueTree] = useState<DialogueNode>(
    createInitialDialogueTree(),
  )
  const [currentPath, setCurrentPath] = useState<string[]>(["root"])
  const [customResponse, setCustomResponse] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [pendingResponseOptions, setPendingResponseOptions] = useState<
    ResponseOption[]
  >([])
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [scenarioName, setScenarioName] = useState("")
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false)
  const [isVisualizationOpen, setIsVisualizationOpen] = useState(false)
  const [narrationUrl, setNarrationUrl] = useState<string | null>(null)

  // If no simulation ID, redirect to cases list
  if (!id) {
    navigate({ to: "/cases" })
    return null
  }

  const simulation = mockSimulations[id]

  // If simulation not found, redirect to cases list
  if (!simulation) {
    navigate({ to: "/cases" })
    return null
  }

  // Mock function to get narration URL
  const getNarrationUrl = async (simulationId: string): Promise<string | null> => {
    // Mocking the endpoint call
    // Let's assume even-numbered simulation IDs have existing narrations
    const simIdNumber = parseInt(simulationId.replace("st", ""), 10)
    if (simIdNumber % 2 === 0) {
      return `/mock-audio/${simulationId}.mp3`
    }
    return null
  }

  useEffect(() => {
    if (id) {
      getNarrationUrl(id).then(setNarrationUrl)
    }
  }, [id])

  // Get current node in the dialogue tree
  const getCurrentNode = (): DialogueNode => {
    let node = dialogueTree
    for (let i = 1; i < currentPath.length; i++) {
      const childNode = node.children.find((child) => child.id === currentPath[i])
      if (!childNode) break
      node = childNode
    }
    return node
  }

  // Get conversation history (all nodes along current path)
  const getConversationHistory = (): DialogueNode[] => {
    const history: DialogueNode[] = []
    let node = dialogueTree
    history.push(node)

    for (let i = 1; i < currentPath.length; i++) {
      const childNode = node.children.find((child) => child.id === currentPath[i])
      if (!childNode) break
      history.push(childNode)
      node = childNode
    }

    return history
  }

  // Get the party whose turn it is
  const getCurrentTurnParty = (): Party => {
    const currentNode = getCurrentNode()
    return currentNode.party === "A" ? "B" : "A"
  }

  // Handle submitting a custom response (Party A's turn)
  const handleSubmitCustomResponse = async () => {
    if (!customResponse.trim() || isLoading) return

    setIsLoading(true)

    const responses = getMockResponses(customResponse)
    setPendingResponseOptions(responses)

    // Add user's response to the tree
    const newNode: DialogueNode = {
      id: `node-${Date.now()}`,
      statement: customResponse,
      party: "A",
      children: [],
    }

    // Update tree
    const updatedTree = { ...dialogueTree }
    const currentNode = getCurrentNodeMutable(updatedTree)
    currentNode.children.push(newNode)

    setDialogueTree(updatedTree)
    setCurrentPath([...currentPath, newNode.id])
    setCustomResponse("")
    setIsLoading(false)
  }

  // Handle selecting a pre-generated response option (Party A's turn)
  const handleSelectPregeneratedResponse = async (responseText: string) => {
    if (isLoading) return

    setIsLoading(true)

    const responses = getMockResponses(responseText)
    setPendingResponseOptions(responses)

    // Add response to the tree
    const newNode: DialogueNode = {
      id: `node-${Date.now()}`,
      statement: responseText,
      party: "A",
      children: [],
    }

    const updatedTree = { ...dialogueTree }
    const currentNode = getCurrentNodeMutable(updatedTree)
    currentNode.children.push(newNode)

    setDialogueTree(updatedTree)
    setCurrentPath([...currentPath, newNode.id])
    setIsLoading(false)
  }

  // Handle selecting opposing counsel's response (Party B's turn)
  const handleSelectOpposingResponse = (responseText: string) => {
    const newNode: DialogueNode = {
      id: `node-${Date.now()}`,
      statement: responseText,
      party: "B",
      children: [],
    }

    const updatedTree = { ...dialogueTree }
    const currentNode = getCurrentNodeMutable(updatedTree)
    currentNode.children.push(newNode)

    setDialogueTree(updatedTree)
    setCurrentPath([...currentPath, newNode.id])
    setPendingResponseOptions([])
  }

  // Helper to get mutable node reference
  const getCurrentNodeMutable = (tree: DialogueNode): DialogueNode => {
    let node = tree
    for (let i = 1; i < currentPath.length; i++) {
      const childNode = node.children.find((child) => child.id === currentPath[i])
      if (!childNode) break
      node = childNode
    }
    return node
  }

  // Handle navigation back to a previous turn
  const handleNavigateToNode = (nodeIndex: number) => {
    const newPath = currentPath.slice(0, nodeIndex + 1)
    setCurrentPath(newPath)

    let node = dialogueTree
    for (let i = 1; i < newPath.length; i++) {
      const childNode = node.children.find((child) => child.id === newPath[i])
      if (!childNode) {
        setPendingResponseOptions([])
        setCustomResponse("")
        return
      }
      node = childNode
    }

    if (node.party === "A") {
      const responses = getMockResponses(node.statement)
      setPendingResponseOptions(responses)
    } else {
      setPendingResponseOptions([])
    }
    setCustomResponse("")
  }

  // Handle going back one step
  const handleBackOne = () => {
    if (currentPath.length > 1) {
      handleNavigateToNode(currentPath.length - 2)
    }
  }

  // Handle save scenario
  const handleSaveScenario = () => {
    if (!scenarioName.trim()) return

    toaster.create({
      title: "Scenario saved",
      description: `"${scenarioName}" has been saved successfully.`,
      type: "success",
      duration: 3000,
    })

    setIsSaveModalOpen(false)
    setScenarioName("")
  }

  // Handle generate voiceover
  const handleGenerateVoiceover = () => {
    setIsGeneratingVoiceover(true)

    setTimeout(() => {
      const newNarrationUrl = `/mock-audio/${id}.mp3`
      setNarrationUrl(newNarrationUrl)
      setIsGeneratingVoiceover(false)
      toaster.create({
        title: "Voiceover generated",
        description: "The conversation voiceover is ready for download.",
        type: "success",
        duration: 3000,
      })
    }, 2000)
  }

  const handlePlayNarration = () => {
    if (narrationUrl) {
      const audio = new Audio(narrationUrl)
      audio.play()
      toaster.create({
        title: "Playing narration",
        description: "Audio playback has started.",
        type: "info",
        duration: 2000,
      })
    }
  }

  // Handle visualize
  const handleVisualize = () => {
    setIsVisualizationOpen(true)
    toaster.create({
      title: "Visualization opened",
      description: "Dialogue tree visualization is now available.",
      type: "info",
      duration: 2000,
    })
  }

  const currentNode = getCurrentNode()
  const conversationHistory = getConversationHistory()
  const currentTurnParty = getCurrentTurnParty()
  const isPartyATurn = currentTurnParty === "A"
  const isPartyBTurn = currentTurnParty === "B"

  // Initial response options for Party A's first turn
  const initialResponseOptions: ResponseOption[] = [
    {
      id: "initial-1",
      text: "My client cannot sell. The children's stability is paramount.",
    },
    {
      id: "initial-2",
      text: "We are not prepared to discuss a sale at this time. Let's focus on custody.",
    },
    {
      id: "initial-3",
      text: "What valuation are you proposing for the home?",
    },
  ]

  return (
    <Box minHeight="100vh" bg="#F4ECD8">
      <HStack alignItems="stretch" gap={0} minHeight="100vh">
        {/* Left Sidebar - Conversation History */}
        <Box
          width="320px"
          bg="white"
          borderRight="1px solid"
          borderColor="gray.200"
          display="flex"
          flexDirection="column"
          position="sticky"
          top={0}
          height="100vh"
        >
          {/* Sidebar Header */}
          <Box p={4} borderBottom="1px solid" borderColor="gray.200">
            <Heading fontSize="lg" fontWeight="semibold" color="#3A3A3A">
              Current Scenario
            </Heading>
          </Box>

          {/* Scrollable History */}
          <Box flex={1} overflowY="auto" p={4}>
            <VStack gap={2} alignItems="stretch">
              {conversationHistory.map((node, index) => (
                <Box
                  key={node.id}
                  p={3}
                  bg="white"
                  border="2px solid"
                  borderColor={node.party === "A" ? "slate.500" : "salmon.500"}
                  borderRadius="md"
                  cursor="pointer"
                  opacity={index === conversationHistory.length - 1 ? 1 : 0.7}
                  _hover={{
                    opacity: 1,
                    shadow: "sm",
                    borderColor: node.party === "A" ? "slate.600" : "salmon.600",
                  }}
                  onClick={() => handleNavigateToNode(index)}
                  transition="all 0.2s"
                >
                  <Text fontSize="xs" fontWeight="bold" color="#3A3A3A" mb={1}>
                    {node.party === "A" ? "Party A" : "Party B"}
                  </Text>
                  <Text fontSize="sm" color="#3A3A3A" lineHeight="1.4">
                    {node.statement}
                  </Text>
                </Box>
              ))}
            </VStack>
          </Box>

          {/* Sidebar Buttons */}
          <Box p={4} borderTop="1px solid" borderColor="gray.200">
            <VStack gap={2} width="100%">
              <Button
                width="100%"
                variant="outline"
                size="sm"
                color="darkGrey.text"
                borderColor="darkGrey.text"
                _hover={{ bg: "gray.100" }}
                onClick={handleVisualize}
              >
                <FiEye />
                Visualize
              </Button>
              <Button
                width="100%"
                variant="outline"
                size="sm"
                color="darkGrey.text"
                borderColor="darkGrey.text"
                _hover={{ bg: "gray.100" }}
                onClick={
                  narrationUrl ? handlePlayNarration : handleGenerateVoiceover
                }
                loading={isGeneratingVoiceover}
                loadingText="Generating..."
              >
                {narrationUrl ? <FiPlay /> : <FiMic />}
                {narrationUrl ? "Play" : "Generate Narration"}
              </Button>
              <Button
                width="100%"
                variant="outline"
                size="sm"
                color="darkGrey.text"
                borderColor="darkGrey.text"
                _hover={{ bg: "gray.100" }}
                onClick={() => setIsSaveModalOpen(true)}
              >
                <FiSave />
                Bookmark
              </Button>
            </VStack>
          </Box>
        </Box>

        {/* Main Content Area */}
        <Box flex={1} p={8}>
          <Container maxW="900px">
            {/* Back to Case Button */}
            <Box mb={4}>
              <Text
                as="button"
                onClick={() =>
                  navigate({ to: "/case", search: { id: simulation.caseId } })
                }
                color="#3A3A3A"
                fontSize="sm"
                _hover={{ textDecoration: "underline" }}
              >
                ← Back to {simulation.caseTitle}
              </Text>
            </Box>

            {/* Simulation Title */}
            <Heading fontSize="2xl" fontWeight="semibold" color="#3A3A3A" mb={6}>
              {simulation.headline}
            </Heading>

            {/* Back Button (if not at root) */}
            {currentPath.length > 1 && (
              <Box mb={4}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBackOne}
                  colorPalette="gray"
                >
                  ← Back
                </Button>
              </Box>
            )}

            <Heading
              fontSize="lg"
              fontWeight="bold"
              color="#3A3A3A"
              textTransform="uppercase"
              mb={3}
            >
              Last Statement
            </Heading>

            {/* Current Statement */}
            <Card.Root
              mb={6}
              bg="white"
              border="2px solid"
              borderColor={currentNode.party === "A" ? "slate.500" : "salmon.500"}
            >
              <Card.Body>
                <VStack alignItems="flex-start" gap={3}>
                  <Text fontSize="lg" color="#3A3A3A" lineHeight="1.6">
                    {currentNode.statement}
                  </Text>
                </VStack>
              </Card.Body>
            </Card.Root>

            {/* Loading State */}
            {isLoading && (
              <Box textAlign="center" py={8}>
                <Spinner size="lg" color="slate" mb={4} />
                <Text fontSize="md" color="#666">
                  Generating responses...
                </Text>
              </Box>
            )}

            {/* Party A's Turn - Show Response Options */}
            {!isLoading && isPartyATurn && (
              <>
                <Heading
                  fontSize="lg"
                fontWeight="bold"
                color="#3A3A3A"
                textTransform="uppercase"
                mb={3}
                >
                  Next Statement
                </Heading>

                <VStack gap={4} alignItems="stretch">
                  {/* Pre-generated options (first turn) or no options yet */}
                  {currentPath.length === 1 &&
                    initialResponseOptions.map((option) => (
                        <Card.Root
                          key={option.id}
                          bg="white"
                          cursor="pointer"
                          _hover={{ shadow: "md", borderColor: "slate.600" }}
                          transition="all 0.2s"
                          border="2px solid"
                          borderColor="slate.500"
                          onClick={() =>
                            handleSelectPregeneratedResponse(option.text)
                          }
                        >
                          <Card.Body>
                            <Text fontSize="md" color="#3A3A3A" lineHeight="1.6">
                              {option.text}
                            </Text>
                          </Card.Body>
                        </Card.Root>
                    ))}

                  {/* Custom Response Card */}
                  <Card.Root bg="white" border="2px solid" borderColor="slate.500">
                    <Card.Body>
                      <VStack alignItems="flex-start" gap={3}>
                        <Text fontSize="sm" fontWeight="semibold" color="#3A3A3A">
                          Write Your Own
                        </Text>
                        <Textarea
                          value={customResponse}
                          onChange={(e) => setCustomResponse(e.target.value)}
                          placeholder="Type your response here..."
                          rows={4}
                          resize="vertical"
                        />
                        <Button
                          size="sm"
                          bg="slate.500"
                          color="white"
                          _hover={{ bg: "slate.600" }}
                          onClick={handleSubmitCustomResponse}
                          disabled={!customResponse.trim()}
                        >
                          Submit
                        </Button>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                </VStack>
              </>
            )}

            {/* Party B's Turn - Show Opposing Counsel's Response Options */}
            {!isLoading && isPartyBTurn && pendingResponseOptions.length > 0 && (
              <>
                <Heading
                  fontSize="lg"
                  fontWeight="bold"
                  color="#3A3A3A"
                  textTransform="uppercase"
                  mb={3}
                >
                  Next Statement
                </Heading>

                <VStack gap={4} alignItems="stretch">
                  {pendingResponseOptions.map((option) => (
                    <Card.Root
                      key={option.id}
                      bg="white"
                      cursor="pointer"
                      _hover={{ shadow: "md", borderColor: "salmon.600" }}
                      transition="all 0.2s"
                      border="2px solid"
                      borderColor="salmon.500"
                      onClick={() => handleSelectOpposingResponse(option.text)}
                    >
                      <Card.Body>
                        <Text fontSize="md" color="#3A3A3A" lineHeight="1.6">
                          {option.text}
                        </Text>
                      </Card.Body>
                    </Card.Root>
                  ))}

                  {/* Custom Response Card for Party B */}
                  <Card.Root bg="white" border="2px solid" borderColor="salmon.500">
                    <Card.Body>
                      <VStack alignItems="flex-start" gap={3}>
                        <Text fontSize="sm" fontWeight="semibold" color="#3A3A3A">
                          Write Your Own
                        </Text>
                        <Textarea
                          value={customResponse}
                          onChange={(e) => setCustomResponse(e.target.value)}
                          placeholder="Type Party B's response here..."
                          rows={4}
                          resize="vertical"
                        />
                        <Button
                          size="sm"
                          bg="salmon.500"
                          color="white"
                          _hover={{ bg: "salmon.600" }}
                          onClick={() => {
                            if (customResponse.trim()) {
                              handleSelectOpposingResponse(customResponse)
                              setCustomResponse("")
                            }
                          }}
                          disabled={!customResponse.trim()}
                        >
                          Submit
                        </Button>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                </VStack>
              </>
            )}
          </Container>
        </Box>
      </HStack>

      {/* Save Scenario Modal */}
      <Dialog.Root
        open={isSaveModalOpen}
        onOpenChange={(e) => setIsSaveModalOpen(e.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <Dialog.Header>
              <Dialog.Title>Save Scenario</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} alignItems="flex-start" width="100%">
                <Text fontSize="sm" color="#666">
                  Give this scenario a name to save it for later reference.
                </Text>
                <Input
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="e.g., Opening Move: Nesting Arrangement"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveScenario()
                  }}
                />
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.CloseTrigger>
              <Button
                bg="#3A3A3A"
                color="#F4ECD8"
                _hover={{ bg: "#2A2A2A" }}
                onClick={handleSaveScenario}
                disabled={!scenarioName.trim()}
              >
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  )
}
