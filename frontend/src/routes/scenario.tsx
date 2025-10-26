import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import {
  Box,
  Button,
  Card,
  Container,
  Heading,
  HStack,
  Icon,
  Input,
  Spinner,
  Switch,
  Tabs,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { Dialog } from "@chakra-ui/react"
import { toaster } from "@/components/ui/toaster"
import { FiSave, FiMic, FiPlay, FiList, FiMap, FiGitBranch, FiRefreshCw } from "react-icons/fi"

interface ScenarioSearchParams {
  id?: string
}

export const Route = createFileRoute("/scenario")({
  validateSearch: (
    search: Record<string, unknown>,
  ): ScenarioSearchParams => {
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
// In production, this would be loaded from the backend based on the node ID
// For the mock, we create a simple tree with the provided node ID as root
const createInitialDialogueTree = (nodeId: string): DialogueNode => ({
  id: nodeId,
  statement:
    "Anna, good to speak. My client has run the numbers, and the most logical step is to sell the home and split the equity. He proposes a 50/50 division.",
  party: "B",
  children: [],
})

// Mock bookmarked scenarios
interface BookmarkedScenario {
  id: string
  name: string
  nodeId: string
  createdAt: Date
}

const mockBookmarkedScenarios: BookmarkedScenario[] = [
  {
    id: "bm1",
    name: "Opening Move: Mediation Start",
    nodeId: "st1-root",
    createdAt: new Date("2025-10-20"),
  },
  {
    id: "bm2",
    name: "Settlement Negotiation Start",
    nodeId: "st2-root",
    createdAt: new Date("2025-10-21"),
  },
]

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

  // If no node ID, redirect to cases list
  if (!id) {
    navigate({ to: "/cases" })
    return null
  }

  // State management
  const [dialogueTree, setDialogueTree] = useState<DialogueNode>(
    createInitialDialogueTree(id)
  )
  const [customResponse, setCustomResponse] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [pendingResponseOptions, setPendingResponseOptions] = useState<
    ResponseOption[]
  >([])
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [scenarioName, setScenarioName] = useState("")
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false)
  const [narrationUrl, setNarrationUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("current")
  const [viewMode, setViewMode] = useState<"conversation" | "tree">("conversation")

  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])


  const handleStartRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    setAudioChunks(chunks);

    recorder.ondataavailable = (event) => {
      chunks.push(event.data);
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
  } catch (err) {
    console.error("Microphone access denied or unavailable:", err);
  }
};


function encodeWAV(audioBuffer: AudioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;

  const samples = interleave(audioBuffer);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");

  // fmt subchunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // subchunk1 size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
  view.setUint16(32, numChannels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

// Helper: interleave channels
function interleave(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const result = new Float32Array(length * numChannels);

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      result[i * numChannels + ch] = buffer.getChannelData(ch)[i];
    }
  }
  return result;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}


const handleStopRecording = async () => {
  if (mediaRecorder) {
    mediaRecorder.onstop = async () => {
      try {
        // Convert recorded chunks to ArrayBuffer
        const blob = new Blob(audioChunks);
        const arrayBuffer = await blob.arrayBuffer();

        // Decode audio
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // Encode to WAV
        const wavBlob = encodeWAV(audioBuffer);

        // Send to backend
        const formData = new FormData();
        formData.append("audio_file", wavBlob, "recording.wav");

        const response = await fetch("http://localhost:8000/api/v1/transcribe-audio", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error(`Transcription failed: ${response.status}`);

        const data = await response.json();
        const transcript = data.message;

        // Instead of appending to general_notes, set it to customResponse
        setCustomResponse(transcript);

      } catch (err) {
        console.error("Error sending audio to backend:", err);
      } finally {
        setIsRecording(false);
        setAudioChunks([]);
      }
    };

    mediaRecorder.stop();
  }
};



  // Mock: Extract simulation ID from node ID
  // In production, the backend would return this with the node data
  const getSimulationId = (nodeId: string): string => {
    // If it starts with "st" followed by a number, extract simulation ID
    const match = nodeId.match(/^(st\d+)/)
    if (match) return match[1]
    // For dynamically created nodes, default to st1 for mock
    return "st1"
  }

  const simulationId = getSimulationId(id)
  const simulation = mockSimulations[simulationId]

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

  // Find a node by ID in the tree (recursive search)
  const findNodeById = (tree: DialogueNode, nodeId: string): DialogueNode | null => {
    if (tree.id === nodeId) return tree

    for (const child of tree.children) {
      const found = findNodeById(child, nodeId)
      if (found) return found
    }

    return null
  }

  // Build path from root to target node
  const buildPathToNode = (tree: DialogueNode, targetId: string, path: DialogueNode[] = []): DialogueNode[] | null => {
    const newPath = [...path, tree]

    if (tree.id === targetId) {
      return newPath
    }

    for (const child of tree.children) {
      const found = buildPathToNode(child, targetId, newPath)
      if (found) return found
    }

    return null
  }

  // Get current node based on URL id parameter
  const getCurrentNode = (): DialogueNode | null => {
    if (!id) return null
    return findNodeById(dialogueTree, id)
  }

  // Get conversation history (all nodes from root to current)
  const getConversationHistory = (): DialogueNode[] => {
    if (!id) return []
    const path = buildPathToNode(dialogueTree, id)
    return path || []
  }

  // Get the party whose turn it is
  const getCurrentTurnParty = (): Party | null => {
    const currentNode = getCurrentNode()
    if (!currentNode) return null
    return currentNode.party === "A" ? "B" : "A"
  }

  // Handle submitting a custom response (Party A's turn)
  const handleSubmitCustomResponse = async () => {
    if (!customResponse.trim() || isLoading || !id) return

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
    const currentNode = findNodeById(updatedTree, id)
    if (currentNode) {
      currentNode.children.push(newNode)
      setDialogueTree(updatedTree)
      setCustomResponse("")

      // Navigate to the new node
      navigate({ to: "/scenario", search: { id: newNode.id } })
    }

    setIsLoading(false)
  }

  // Handle selecting a pre-generated response option (Party A's turn)
  const handleSelectPregeneratedResponse = async (responseText: string) => {
    if (isLoading || !id) return

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
    const currentNode = findNodeById(updatedTree, id)
    if (currentNode) {
      currentNode.children.push(newNode)
      setDialogueTree(updatedTree)

      // Navigate to the new node
      navigate({ to: "/scenario", search: { id: newNode.id } })
    }

    setIsLoading(false)
  }

  // Handle selecting opposing counsel's response (Party B's turn)
  const handleSelectOpposingResponse = (responseText: string) => {
    if (!id) return

    const newNode: DialogueNode = {
      id: `node-${Date.now()}`,
      statement: responseText,
      party: "B",
      children: [],
    }

    const updatedTree = { ...dialogueTree }
    const currentNode = findNodeById(updatedTree, id)
    if (currentNode) {
      currentNode.children.push(newNode)
      setDialogueTree(updatedTree)
      setPendingResponseOptions([])

      // Navigate to the new node
      navigate({ to: "/scenario", search: { id: newNode.id } })
    }
  }

  // Handle navigation to a specific node in history
  const handleNavigateToNode = (nodeId: string) => {
    // Simply navigate to the node ID - the URL will update and component will re-render
    navigate({ to: "/scenario", search: { id: nodeId } })

    // Update pending responses based on the node
    const node = findNodeById(dialogueTree, nodeId)
    if (node && node.party === "A") {
      const responses = getMockResponses(node.statement)
      setPendingResponseOptions(responses)
    } else {
      setPendingResponseOptions([])
    }
    setCustomResponse("")
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

  // // Handle visualize
  // const handleVisualize = () => {
  //   setIsVisualizationOpen(true)
  //   toaster.create({
  //     title: "Visualization opened",
  //     description: "Dialogue tree visualization is now available.",
  //     type: "info",
  //     duration: 2000,
  //   })
  // }

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
    <Box minHeight="100vh" bg="#F4ECD8" py={8}>
      <Container maxW="1200px">
        {/* Simulation Title */}
        <Heading fontSize="3xl" fontWeight="bold" color="#3A3A3A" mb={6}>
          {simulation.headline}
        </Heading>

        <HStack alignItems="stretch" gap={6}>
          {/* Left Column - Conversation History */}
          <Box
            width="280px"
            bg="white"
            borderRadius="md"
            shadow="sm"
            display="flex"
            flexDirection="column"
            // minHeight="calc(100vh - 120px)"
            maxHeight="calc(100vh - 120px)"
          >
          {/* Sidebar Header */}
          <Box p={4} borderBottom="1px solid" borderColor="gray.200">
            <Heading fontSize="xl" fontWeight="semibold" color="#3A3A3A">
              Scenarios
            </Heading>
          </Box>

          {/* Tabs */}
          <Tabs.Root
            value={activeTab}
            onValueChange={(e) => setActiveTab(e.value)}
            flex={1}
            display="flex"
            flexDirection="column"
          >
            <Tabs.List px={4} pt={2}>
              <Tabs.Trigger value="current" fontWeight="semibold">Current</Tabs.Trigger>
              <Tabs.Trigger value="bookmarked" fontWeight="semibold">Bookmarked</Tabs.Trigger>
            </Tabs.List>

            {/* Current Tab - Conversation History */}
            <Tabs.Content value="current" flex={1} overflowY="auto" p={4}>
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
                    onClick={() => handleNavigateToNode(node.id)}
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
            </Tabs.Content>

            {/* Bookmarked Tab - Saved Scenarios */}
            <Tabs.Content value="bookmarked" flex={1} overflowY="auto" p={4}>
              <VStack gap={3} alignItems="stretch">
                {mockBookmarkedScenarios.map((bookmark) => (
                  <Card.Root
                    key={bookmark.id}
                    bg="white"
                    cursor="pointer"
                    _hover={{ shadow: "md" }}
                    transition="all 0.2s"
                    onClick={() =>
                      navigate({ to: "/scenario", search: { id: bookmark.nodeId } })
                    }
                  >
                    <Card.Body p={3}>
                      <VStack alignItems="flex-start" gap={2}>
                        <Text fontSize="sm" fontWeight="semibold" color="#3A3A3A">
                          {bookmark.name}
                        </Text>
                        <Text fontSize="xs" color="#999">
                          {bookmark.createdAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Text>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                ))}
              </VStack>
            </Tabs.Content>
          </Tabs.Root>

          {/* Sidebar Buttons - Only show in Current tab */}
          {activeTab === "current" && (
            <Box p={4} borderTop="1px solid" borderColor="gray.200">
              <VStack gap={2} width="100%">
                {/* <Button
                  width="100%"
                  variant="outline"
                  size="sm"
                  color="darkGrey.text"
                  borderColor="darkGrey.text"
                  _hover={{ bg: "gray.100" }}
                  onClick={() => setViewMode(viewMode === "tree" ? "conversation" : "tree")}
                >
                  <FiEye />
                  {viewMode === "tree" ? "Conversation" : "Tree View"}
                </Button> */}
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
          )}
        </Box>

        {/* Main Content Area */}
        <Box flex={1}>

            {/* View Mode Switch */}
            <Box
              bg="white"
              borderRadius="md"
              mb={6}
              shadow="sm"
            >
              {/* Explorer Header */}
              <Box p={4} borderBottom="1px solid" borderColor="gray.200">
                <Heading fontSize="xl" fontWeight="semibold" color="#3A3A3A">
                  Scenario Explorer
                </Heading>
              </Box>

              {/* Switch */}
              <Box p={4}>
                <Switch.Root
                  size="lg"
                  colorPalette="slate"
                  checked={viewMode === "tree"}
                  onCheckedChange={(e) => setViewMode(e.checked ? "tree" : "conversation")}
                >
                  <Switch.HiddenInput />
                  <Switch.Control>
                    <Switch.Thumb />
                    <Switch.Indicator fallback={<Icon as={FiList} color="gray.600" />}>
                      <Icon as={FiMap} color="slate.600" />
                    </Switch.Indicator>
                  </Switch.Control>
                  <Switch.Label fontWeight="semibold" color="#3A3A3A">
                    {viewMode === "conversation" ? "Turn-by-Turn" : "Overview"}
                  </Switch.Label>
                </Switch.Root>
              </Box>
            </Box>

            {currentNode && (
              <>
                {viewMode === "conversation" ? (
                  <>
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
                    <HStack gap={2} align="center" mb={3}>
                      <Heading
                        fontSize="lg"
                        fontWeight="bold"
                        color="#3A3A3A"
                        textTransform="uppercase"
                      >
                        Next Statement
                      </Heading>
                      {/* Regenerate button - TODO: Backend integration needed */}
                      {/* When clicked, should call API to regenerate dialogue tree with current node as root */}
                      {/* This will provide new response options based on the last statement */}
                      <Button
                        variant="ghost"
                        size="xs"
                        color="#3A3A3A"
                        _hover={{ bg: "gray.100" }}
                        onClick={() => {
                          // TODO: Implement backend call to regenerate tree
                          // API endpoint should accept current node ID and return new response options
                          console.log("Regenerate options for current node")
                        }}
                      >
                        <Icon as={FiRefreshCw} boxSize={4} />
                      </Button>
                    </HStack>

                    <VStack gap={4} alignItems="stretch">
                      {/* Pre-generated options (first turn) or no options yet */}
                      {conversationHistory.length === 1 &&
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

                    <VStack align="stretch" gap={3} width="100%">
                      <Textarea
                        value={customResponse}
                        onChange={(e) => setCustomResponse(e.target.value)}
                        placeholder="Type your response here..."
                        rows={4}
                        resize="vertical"
                        width="100%" // make textarea full width
                      />

                      <HStack justify="space-between" width="100%">
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

                        <Button
                          size="sm"
                          colorScheme={isRecording ? "red" : "gray"}
                          onClick={() => {
                            if (isRecording) handleStopRecording()
                            else handleStartRecording()
                          }}
                        >
                          {isRecording ? "Stop Recording" : "🎤 Record"}
                        </Button>
                      </HStack>
                    </VStack>




                            {/*<Textarea*/}
                            {/*  value={customResponse}*/}
                            {/*  onChange={(e) => setCustomResponse(e.target.value)}*/}
                            {/*  placeholder="Type your response here..."*/}
                            {/*  rows={4}*/}
                            {/*  resize="vertical"*/}
                            {/*/>*/}
                            {/*<div flexDirection="row" alignItems="">*/}
                            {/* <Button*/}
                            {/*  size="sm"*/}
                            {/*  colorScheme={isRecording ? "red" : "gray"}*/}
                            {/*  onClick={() => {*/}
                            {/*    if (isRecording) handleStopRecording()*/}
                            {/*    else handleStartRecording()*/}
                            {/*  }}*/}
                            {/*>*/}
                            {/*  {isRecording ? "Stop Recording" : "🎤 Record"}*/}
                            {/*</Button>*/}
                            {/*<Button*/}
                            {/*  size="sm"*/}
                            {/*  bg="slate.500"*/}
                            {/*  color="white"*/}
                            {/*  _hover={{ bg: "slate.600" }}*/}
                            {/*  onClick={handleSubmitCustomResponse}*/}
                            {/*  disabled={!customResponse.trim()}*/}
                            {/*>*/}
                            {/*  Submit*/}
                            {/*</Button>*/}
                          </VStack>
                        </Card.Body>
                      </Card.Root>
                    </VStack>
                  </>
                )}

                {/* Party B's Turn - Show Opposing Counsel's Response Options */}
                {!isLoading && isPartyBTurn && pendingResponseOptions.length > 0 && (
                  <>
                    <HStack gap={1} align="center" mb={3}>
                      <Heading
                        fontSize="lg"
                        fontWeight="bold"
                        color="#3A3A3A"
                        textTransform="uppercase"
                      >
                        Next Statement
                      </Heading>
                      {/* Regenerate button - TODO: Backend integration needed */}
                      {/* When clicked, should call API to regenerate dialogue tree with current node as root */}
                      {/* This will provide new response options based on the last statement */}
                      <Button
                        variant="ghost"
                        size="xs"
                        color="#3A3A3A"
                        _hover={{ bg: "gray.100" }}
                        onClick={() => {
                          // TODO: Implement backend call to regenerate tree
                          // API endpoint should accept current node ID and return new response options
                          console.log("Regenerate options for current node")
                        }}
                      >
                        <Icon as={FiRefreshCw} boxSize={4} />
                      </Button>
                    </HStack>

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
                              colorScheme={isRecording ? "red" : "gray"}
                              onClick={() => {
                                if (isRecording) handleStopRecording()
                                else handleStartRecording()
                              }}
                            >
                              {isRecording ? "Stop Recording" : "🎤 Record"}
                            </Button>
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
                  </>
                ) : (
                  <>
                    {/* Tree Visualization View - Placeholder */}
                    <Box
                      bg="white"
                      borderRadius="md"
                      border="2px dashed"
                      borderColor="gray.300"
                      p={12}
                      textAlign="center"
                      minHeight="500px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <VStack gap={4}>
                        <Icon as={FiGitBranch} boxSize={16} color="gray.400" />
                        <Heading fontSize="xl" color="gray.600" fontWeight="medium">
                          Tree Visualization
                        </Heading>
                        <Text fontSize="md" color="gray.500" maxW="400px">
                          Interactive dialogue tree visualization will be displayed here, showing all conversation paths and branches.
                        </Text>
                      </VStack>
                    </Box>
                  </>
                )}
              </>
            )}
        </Box>
      </HStack>
      </Container>


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
