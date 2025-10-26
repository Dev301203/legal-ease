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
  ScrollArea,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { Dialog } from "@chakra-ui/react"
import { toaster } from "@/components/ui/toaster"
import { FiSave, FiMic, FiPlay, FiList, FiMap, FiRefreshCw, FiTrash2, FiRotateCw } from "react-icons/fi"
import type { DialogueNode, ResponseOption } from "@/types/scenario"
import {
  loadSimulationTree,
  continueConversation,
  createCustomMessage,
  getSimulation,
  createBookmark,
  getBookmarks,
  deleteBookmark,
  getConversationAudio,
} from "@/services/scenarioService"
import {
  buildDialogueTreeFromMessages,
  findNodeInTree,
  getSelectedPath,
  getPathToNode,
  updateSelectedPath,
  isLeafNode,
} from "@/utils/treeUtils"
import Flow from "./tree";


interface ScenarioSearchParams {
  caseId: number
  simulationId: number
  messageId?: number
}

export const Route = createFileRoute("/scenario")({
  validateSearch: (
    search: Record<string, unknown>,
  ): ScenarioSearchParams => {
    return {
      caseId: Number(search.caseId),
      simulationId: Number(search.simulationId),
      messageId: search.messageId ? Number(search.messageId) : undefined,
    }
  },
  component: SimulationPage,
})

function SimulationPage() {
  const navigate = useNavigate()
  const { caseId, simulationId, messageId } = Route.useSearch()

  // State management - NEW
  const [fullTree, setFullTree] = useState<DialogueNode | null>(null)
  const [currentMessageId, setCurrentMessageId] = useState<number | null>(messageId || null)
  const [error, setError] = useState<string | null>(null)
  const [simulationTitle, setSimulationTitle] = useState<string>("")

  // State management - EXISTING (keep these)
  const [customResponse, setCustomResponse] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingResponses, setIsGeneratingResponses] = useState(false)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [scenarioName, setScenarioName] = useState("")
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false)
  const [narrationUrl, setNarrationUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("current")
  const [viewMode, setViewMode] = useState<"conversation" | "tree">("conversation")
  const [bookmarks, setBookmarks] = useState<Array<{
    id: number
    simulation_id: number
    message_id: number
    name: string
  }>>([])

  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])

  // Initial data loading effect
  useEffect(() => {
    async function loadTreeData() {
      setIsLoading(true)
      setError(null)

      try {
        // Load simulation details, message tree, and bookmarks in parallel
        const [simulation, messages, bookmarksData] = await Promise.all([
          getSimulation(simulationId),
          loadSimulationTree(simulationId),
          getBookmarks(simulationId).catch(() => []) // Ignore errors, default to empty array
        ])

        // Set simulation title
        setSimulationTitle(simulation.headline)
        
        // Set bookmarks
        setBookmarks(bookmarksData)

        if (!messages || messages.length === 0) {
          setError("No messages found for this simulation")
          setIsLoading(false)
          return
        }

        // Convert to DialogueNode structure
        const tree = buildDialogueTreeFromMessages(messages)

        if (!tree) {
          setError("Failed to build dialogue tree")
          setIsLoading(false)
          return
        }

        setFullTree(tree)

        // Determine current message
        if (messageId) {
          setCurrentMessageId(messageId)
        } else {
          // Default to root message
          setCurrentMessageId(Number(tree.id))
        }

        setIsLoading(false)
      } catch (err: any) {
        console.error("Error loading simulation tree:", err)
        setError(err.message || "Failed to load simulation")
        setIsLoading(false)
      }
    }

    loadTreeData()
  }, [simulationId, messageId])

  // Helper to get conversation history (selected path)
  const conversationHistory = fullTree
    ? currentMessageId
      ? getPathToNode(fullTree, String(currentMessageId))
      : getSelectedPath(fullTree)
    : []

  // Helper to get current node
  const currentNode = fullTree && currentMessageId
    ? findNodeInTree(fullTree, String(currentMessageId))
    : null

  // Helper to get available response options
  const responseOptions: ResponseOption[] = currentNode
    ? currentNode.children.map(child => ({
        id: child.id,
        text: child.statement,
        party: child.party,
      }))
    : []

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
        setCustomResponse((prev) => prev + " " + transcript);

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

  // Handle submitting a custom user response
  const handleSubmitCustomResponse = async () => {
    if (!customResponse.trim() || isGeneratingResponses || !fullTree || !currentMessageId) return

    setIsGeneratingResponses(true)

    try {
      // Determine the role from the current node's children
      // The custom response should match the role of the available options
      const node = findNodeInTree(fullTree, String(currentMessageId))
      const role = node && node.children && node.children.length > 0
        ? node.children[0].party // Get role from first child
        : "user" // Default fallback

      console.log("role", role)

      // Step 1: Create the custom message in the backend
      const newMessage = await createCustomMessage(
        simulationId,
        currentMessageId,
        customResponse,
        role
      )

      // Step 3: Call continue-conversation to generate AI responses
      await continueConversation(caseId, newMessage.id, simulationId, false)

      // Step 4: Reload the full tree from backend to get the newly generated subtree
      const updatedMessages = await loadSimulationTree(simulationId)
      const freshTree = buildDialogueTreeFromMessages(updatedMessages)

      if (!freshTree) {
        throw new Error("Failed to rebuild dialogue tree after generation")
      }

      // Step 5: Update state with fresh tree
      setFullTree(freshTree)
      setCustomResponse("")

      // Step 6: Navigate to the new custom message node
      navigate({
        to: "/scenario",
        search: {
          caseId,
          simulationId,
          messageId: newMessage.id,
        },
      })

      toaster.create({
        title: "Response submitted",
        type: "success",
      })
    } catch (err: any) {
      console.error("Error submitting custom response:", err)
      toaster.create({
        title: "Failed to submit response",
        description: err.message,
        type: "error",
      })
    } finally {
      setIsGeneratingResponses(false)
    }
  }

  // Handle selecting a pre-generated response option
  const handleSelectPregeneratedResponse = async (responseId: string) => {
    if (isGeneratingResponses || !fullTree) return

    try {
      const selectedNode = findNodeInTree(fullTree, responseId)
      if (!selectedNode) {
        throw new Error("Selected response not found in tree")
      }

      const messageIdNum = Number(responseId)
      const isLeaf = isLeafNode(selectedNode)

      // Step 1: Update local tree selection
      const updatedTree = updateSelectedPath(fullTree, responseId)
      setFullTree(updatedTree)

      // Step 2: If it's a leaf node, generate responses first, THEN navigate
      if (isLeaf) {
        setIsGeneratingResponses(true)
        setCurrentMessageId(messageIdNum) // Update current message ID for the UI

        try {
          // Leaf node - need to generate new responses
          await continueConversation(caseId, messageIdNum, simulationId, false)

          // Reload the full tree from backend to get the newly generated subtree
          const updatedMessages = await loadSimulationTree(simulationId)
          const freshTree = buildDialogueTreeFromMessages(updatedMessages)

          if (freshTree) {
            setFullTree(freshTree)
          }
        } catch (genErr: any) {
          console.error("Error generating new responses:", genErr)
          toaster.create({
            title: "Failed to generate responses",
            description: genErr.message,
            type: "error",
          })
        } finally {
          setIsGeneratingResponses(false)
        }
      }

      // Step 3: Navigate to selected node (after generation for leaf nodes)
      navigate({
        to: "/scenario",
        search: {
          caseId,
          simulationId,
          messageId: messageIdNum,
        },
      })
    } catch (err: any) {
      console.error("Error selecting response:", err)
      toaster.create({
        title: "Failed to select response",
        description: err.message,
        type: "error",
      })
      setIsGeneratingResponses(false)
    }
  }

  // Handle navigation to a specific node in history
  const handleNavigateToNode = (nodeId: string) => {
    const messageIdNum = Number(nodeId)
    navigate({
      to: "/scenario",
      search: {
        caseId,
        simulationId,
        messageId: messageIdNum,
      },
    })
  }

  // Handle regenerate responses
  const handleRegenerateResponses = async () => {
    if (!currentMessageId || !simulationId || !caseId) return

    setIsGeneratingResponses(true)

    try {
      // Call continue-conversation with refresh=true to regenerate
      await continueConversation(caseId, currentMessageId, simulationId, true)

      // Reload the full tree from backend to get the newly generated subtree
      const updatedMessages = await loadSimulationTree(simulationId)
      const freshTree = buildDialogueTreeFromMessages(updatedMessages)

      if (!freshTree) {
        throw new Error("Failed to rebuild dialogue tree after regeneration")
      }

      // Update state with fresh tree
      setFullTree(freshTree)

      toaster.create({
        title: "Responses regenerated",
        description: "New response options have been generated.",
        type: "success",
        duration: 3000,
      })
    } catch (err: any) {
      console.error("Error regenerating responses:", err)
      toaster.create({
        title: "Failed to regenerate responses",
        description: err.message || "An error occurred while regenerating.",
        type: "error",
        duration: 5000,
      })
    } finally {
      setIsGeneratingResponses(false)
    }
  }

  // Handle save scenario
  const handleSaveScenario = async () => {
    if (!scenarioName.trim() || !currentMessageId || !simulationId) return

    try {
      await createBookmark(simulationId, currentMessageId, scenarioName)

      // Refresh bookmarks list
      const updatedBookmarks = await getBookmarks(simulationId)
      setBookmarks(updatedBookmarks)

      toaster.create({
        title: "Scenario saved",
        description: `"${scenarioName}" has been saved successfully.`,
        type: "success",
        duration: 3000,
      })

      setIsSaveModalOpen(false)
      setScenarioName("")
    } catch (err: any) {
      console.error("Error saving bookmark:", err)
      toaster.create({
        title: "Failed to save scenario",
        description: err.message || "An error occurred while saving.",
        type: "error",
        duration: 3000,
      })
    }
  }

  // Handle navigate to bookmark
  const handleNavigateToBookmark = async (bookmark: { message_id: number; name: string }) => {
    try {
      // Navigate to the bookmarked message
      navigate({
        to: "/scenario",
        search: {
          caseId,
          simulationId,
          messageId: bookmark.message_id,
        },
      })
      
      // Switch to current tab to see the conversation
      setActiveTab("current")
    } catch (err) {
      console.error("Error navigating to bookmark:", err)
      toaster.create({
        title: "Failed to load bookmark",
        description: "Could not navigate to the bookmarked scenario.",
        type: "error",
      })
    }
  }

  // Handle delete bookmark
  const handleDeleteBookmark = async (bookmarkId: number) => {
    try {
      await deleteBookmark(bookmarkId)
      
      // Refresh bookmarks list
      const updatedBookmarks = await getBookmarks(simulationId)
      setBookmarks(updatedBookmarks)
      
      toaster.create({
        title: "Bookmark deleted",
        description: "The bookmark has been removed successfully.",
        type: "success",
        duration: 2000,
      })
    } catch (err: any) {
      console.error("Error deleting bookmark:", err)
      toaster.create({
        title: "Failed to delete bookmark",
        description: err.message || "An error occurred while deleting.",
        type: "error",
      })
    }
  }

  // Handle generate voiceover
  const handleGenerateVoiceover = async () => {
    if (!currentMessageId || !simulationId) {
      toaster.create({
        title: "Cannot generate narration",
        description: "No message selected",
        type: "warning",
      })
      return
    }

    setIsGeneratingVoiceover(true)

    try {
      // Fetch audio from backend
      const audioBlob = await getConversationAudio(simulationId, currentMessageId)
      
      // Create object URL for the audio blob
      const audioUrl = URL.createObjectURL(audioBlob)
      setNarrationUrl(audioUrl)

      toaster.create({
        title: "Narration generated",
        description: "Audio narration has been created successfully.",
        type: "success",
        duration: 3000,
      })
    } catch (err: any) {
      console.error("Error generating voiceover:", err)
      toaster.create({
        title: "Failed to generate narration",
        description: err.message || "An error occurred while generating audio.",
        type: "error",
        duration: 5000,
      })
    } finally {
      setIsGeneratingVoiceover(false)
    }
  }

  const handlePlayNarration = async () => {
    if (!narrationUrl) {
      toaster.create({
        title: "No narration available",
        description: "Please generate narration first.",
        type: "warning",
      })
      return
    }

    try {
      const audio = new Audio(narrationUrl)
      
      // Handle audio events
      audio.onerror = (e) => {
        console.error("Audio playback error:", e)
        toaster.create({
          title: "Failed to play audio",
          description: "The audio file could not be played.",
          type: "error",
        })
      }

      // Play the audio
      await audio.play()
      
      toaster.create({
        title: "Playing narration",
        description: "Audio playback started.",
        type: "info",
        duration: 2000,
      })
    } catch (err: any) {
      console.error("Error playing audio:", err)
      toaster.create({
        title: "Failed to play audio",
        description: err.message || "Could not start audio playback.",
        type: "error",
      })
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <Box minHeight="100vh" bg="#F4ECD8" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" color="#3A3A3A" />
      </Box>
    )
  }

  // Show error state
  if (error) {
    return (
      <Box minHeight="100vh" bg="#F4ECD8" display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={8}>
        <Text fontSize="xl" color="red.600" mb={4}>{error}</Text>
        <Button onClick={() => navigate({ to: "/cases" })}>Return to Cases</Button>
      </Box>
    )
  }

  // Show empty state if no tree loaded
  if (!fullTree) {
    return (
      <Box minHeight="100vh" bg="#F4ECD8" display="flex" alignItems="center" justifyContent="center">
        <Text fontSize="xl" color="#3A3A3A">No conversation data available</Text>
      </Box>
    )
  }

  return (
    <Box minHeight="100vh" bg="#F4ECD8" py={8}>
      <Container maxW="1200px">
        {/* Simulation Title */}
        <Heading fontSize="3xl" fontWeight="bold" color="#3A3A3A" mb={6}>
          {simulationTitle || "Scenario Explorer"}
        </Heading>

        <HStack alignItems="flex-start" gap={6}>
          {/* Left Column - Conversation History */}
          <Box
            width="280px"
            bg="white"
            borderRadius="md"
            shadow="sm"
            display="flex"
            flexDirection="column"
            position="sticky"
            top="32px"
            height="calc(100vh - 160px)"
          >
          {/* Sidebar Header */}
          <Box p={4} borderBottom="1px solid" borderColor="gray.200" flexShrink={0}>
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
            minH={0}
          >
            <Tabs.List px={4} pt={2} flexShrink={0}>
              <Tabs.Trigger value="current" fontWeight="semibold">Current</Tabs.Trigger>
              <Tabs.Trigger value="bookmarked" fontWeight="semibold">Bookmarked</Tabs.Trigger>
            </Tabs.List>

            {/* Current Tab - Conversation History */}
            <Tabs.Content value="current" flex={1} display="flex" flexDirection="column" minH={0} padding="0px">
              <ScrollArea.Root flex={1} minH={0}>
                <ScrollArea.Viewport>
                  <ScrollArea.Content p={4} padding="4" textStyle="sm">
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
                  </ScrollArea.Content>
                </ScrollArea.Viewport>
                <ScrollArea.Scrollbar />
              </ScrollArea.Root>
              <Box p={4} borderTop="1px solid" borderColor="gray.200" flexShrink={0}>
                <VStack gap={2} width="100%">
                  {narrationUrl ? (
                    <>
                      <HStack width="100%" gap={2}>
                        <Button
                          flex={1}
                          variant="outline"
                          size="sm"
                          color="darkGrey.text"
                          borderColor="darkGrey.text"
                          _hover={{ bg: "gray.100" }}
                          onClick={handlePlayNarration}
                        >
                          <FiPlay />
                          Play
                        </Button>
                        <Button
                          flex={1}
                          variant="outline"
                          size="sm"
                          color="darkGrey.text"
                          borderColor="darkGrey.text"
                          _hover={{ bg: "gray.100" }}
                          onClick={handleGenerateVoiceover}
                          loading={isGeneratingVoiceover}
                          loadingText="Generating..."
                        >
                          <FiRotateCw />
                          Regenerate
                        </Button>
                      </HStack>
                    </>
                  ) : (
                    <Button
                      width="100%"
                      variant="outline"
                      size="sm"
                      color="darkGrey.text"
                      borderColor="darkGrey.text"
                      _hover={{ bg: "gray.100" }}
                      onClick={handleGenerateVoiceover}
                      loading={isGeneratingVoiceover}
                      loadingText="Generating..."
                    >
                      <FiMic />
                      Generate Narration
                    </Button>
                  )}
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
            </Tabs.Content>

            {/* Bookmarked Tab - Saved Scenarios */}
            <Tabs.Content value="bookmarked" flex={1} display="flex" flexDirection="column" minH={0}>
              <ScrollArea.Root flex={1} minH={0}>
                <ScrollArea.Viewport>
                  <ScrollArea.Content p={4} paddingEnd="3" textStyle="sm">
                    <VStack gap={3} alignItems="stretch">
                      {bookmarks.length === 0 ? (
                        <Text fontSize="sm" color="#999" textAlign="center" py={4}>
                          No bookmarks yet. Create one by clicking "Bookmark" below.
                        </Text>
                      ) : (
                        bookmarks.map((bookmark) => (
                          <Box
                            key={bookmark.id}
                            p={3}
                            bg="white"
                            border="1px solid"
                            borderColor="gray.300"
                            borderRadius="md"
                            _hover={{
                              borderColor: "slate.500",
                              shadow: "sm",
                            }}
                          >
                            <HStack justify="space-between" align="start" mb={2}>
                              <Text
                                fontSize="sm"
                                fontWeight="semibold"
                                color="#3A3A3A"
                                cursor="pointer"
                                onClick={() => handleNavigateToBookmark(bookmark)}
                              >
                                {bookmark.name}
                              </Text>
                              <Button
                                size="xs"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => handleDeleteBookmark(bookmark.id)}
                              >
                                <Icon as={FiTrash2} />
                              </Button>
                            </HStack>
                          </Box>
                        ))
                      )}
                    </VStack>
                  </ScrollArea.Content>
                </ScrollArea.Viewport>
                <ScrollArea.Scrollbar />
              </ScrollArea.Root>
              <Box p={4} borderTop="1px solid" borderColor="gray.200" flexShrink={0}>
                <VStack gap={2} width="100%">
                  {narrationUrl ? (
                    <>
                      <HStack width="100%" gap={2}>
                        <Button
                          flex={1}
                          variant="outline"
                          size="sm"
                          color="darkGrey.text"
                          borderColor="darkGrey.text"
                          _hover={{ bg: "gray.100" }}
                          onClick={handlePlayNarration}
                        >
                          <FiPlay />
                          Play
                        </Button>
                        <Button
                          flex={1}
                          variant="outline"
                          size="sm"
                          color="darkGrey.text"
                          borderColor="darkGrey.text"
                          _hover={{ bg: "gray.100" }}
                          onClick={handleGenerateVoiceover}
                          loading={isGeneratingVoiceover}
                          loadingText="Generating..."
                        >
                          <FiRotateCw />
                          Regenerate
                        </Button>
                      </HStack>
                    </>
                  ) : (
                    <Button
                      width="100%"
                      variant="outline"
                      size="sm"
                      color="darkGrey.text"
                      borderColor="darkGrey.text"
                      _hover={{ bg: "gray.100" }}
                      onClick={handleGenerateVoiceover}
                      loading={isGeneratingVoiceover}
                      loadingText="Generating..."
                    >
                      <FiMic />
                      Generate Narration
                    </Button>
                  )}
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
            </Tabs.Content>
          </Tabs.Root>
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

                {/* Response Options Section */}
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
                    {/* Spinner next to header when generating */}
                    {isGeneratingResponses && (
                      <Spinner size="sm" color="#3A3A3A" />
                    )}
                    {/* Regenerate button */}
                    {!isGeneratingResponses && (
                      <Button
                        variant="ghost"
                        size="xs"
                        color="#3A3A3A"
                        _hover={{ bg: "gray.100" }}
                        onClick={handleRegenerateResponses}
                      >
                        <Icon as={FiRefreshCw} boxSize={4} />
                      </Button>
                    )}
                  </HStack>

                  {/* Loading state while generating responses */}
                  {isGeneratingResponses && (
                    <VStack gap={4} alignItems="stretch">
                      <Skeleton height="80px" borderRadius="md" />
                      <Skeleton height="80px" borderRadius="md" />
                      <Skeleton height="80px" borderRadius="md" />
                    </VStack>
                  )}

                  {/* Response options - show when not generating */}
                  {!isGeneratingResponses && (
                    <VStack gap={4} alignItems="stretch">
                      {/* Pre-generated response options (children of current node) */}
                      {responseOptions.map((option) => (
                        <Card.Root
                          key={option.id}
                          bg="white"
                          cursor="pointer"
                          _hover={{
                            shadow: "md",
                            borderColor: option.party === "A" ? "slate.600" : "salmon.600"
                          }}
                          transition="all 0.2s"
                          border="2px solid"
                          borderColor={option.party === "A" ? "slate.500" : "salmon.500"}
                          onClick={() =>
                            handleSelectPregeneratedResponse(option.id)
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
                                  {isRecording ? "🎤 Stop Recording" : "🎤 Record"}
                                </Button>
                              </HStack>
                            </VStack>
                          </VStack>
                        </Card.Body>
                      </Card.Root>
                    </VStack>
                  )}
                </>
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
                     <Box
                    bg="white"
                    borderRadius="md"
                    border="2px dashed"
                    borderColor="gray.300"
                    p={4}
                    height="500px"
                    width="100%"
                    position="relative"
                  >
                    <Flow simulationId={simulationId} />
                   </Box>

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
