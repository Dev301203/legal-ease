import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import {
  Box,
  Button,
  Card,
  Collapsible,
  Container,
  Dialog,
  Heading,
  HStack,
  Text,
  Textarea,
  VStack,
  Spinner,
} from "@chakra-ui/react"

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

  const [saving, setSaving] = useState(false)
  const [isEditBackgroundOpen, setIsEditBackgroundOpen] = useState(false)
  const [editedBackground, setEditedBackground] = useState<CaseBackground>({
    party_a: "",
    party_b: "",
    key_issues: "",
    general_notes: "",
  })
  const [isBackgroundEdited, setIsBackgroundEdited] = useState(false)

  const [isNewSimulationOpen, setIsNewSimulationOpen] = useState(false)
  const [simulationTitle, setSimulationTitle] = useState("")
  const [simulationBrief, setSimulationBrief] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

// const [recognition, setRecognition] = useState<any>(null)
const [isRecording, setIsRecording] = useState(false)
const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
// const [audioChunks, setAudioChunks] = useState<Blob[]>([])
//


const [audioChunks, setAudioChunks] = useState<Blob[]>([]);


  // Track the case ID to detect when we've loaded a different case
  const [loadedCaseId, setLoadedCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (caseData && caseData.id !== loadedCaseId) {
      setEditedBackground(caseData.background);
      setIsBackgroundEdited(false);
      setLoadedCaseId(caseData.id);
    }
  }, [caseData, loadedCaseId]);

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

        // Update the general_notes in state
        setEditedBackground((prev) => ({
          ...prev,
          general_notes: prev.general_notes
            ? prev.general_notes + "\n" + transcript
            : transcript,
        }));
        setCaseData((prev) =>
          prev
            ? {
                ...prev,
                background: {
                  ...prev.background,
                  general_notes: prev.background.general_notes
                    ? prev.background.general_notes + "\n" + transcript
                    : transcript,
                },
              }
            : prev
        );
        setIsBackgroundEdited(true);

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

// WAV encoding function
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
          ? rawBg.key_issues.map((issue: string) => `• ${issue}`).join("\n")
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


  const handleSaveCase = async () => {
    if (!caseData) return

    // Merge caseData.background with editedBackground for general_notes
    const updatedBackground = {
      ...caseData.background,
      general_notes: editedBackground.general_notes,
    };

    setSaving(true)
    try {

      const response = await fetch(`http://localhost:8000/api/v1/cases/${caseData.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedBackground),
    });

      if (!response.ok) {
        throw new Error(`Failed to save case: ${response.status}`)
      }

      // Get the updated case data including the regenerated summary
      const data = await response.json()

      // Update both the summary and background to preserve the saved data
      setCaseData({
        ...caseData,
        summary: data.summary,
        background: updatedBackground
      })

      // Reset the edited flag after successful save
      setIsBackgroundEdited(false)

      // Show success message or update UI
      console.log("Case saved successfully")
    } catch (err: any) {
      console.error(err)
      alert(err.message || "Error saving case data")
    } finally {
      setSaving(false)
    }
  }

  const handleNewSimulation = () => {
    setSimulationTitle("")
    setSimulationBrief("")
    setIsNewSimulationOpen(true)
  }

  const handleSaveBackground = () => { setIsEditBackgroundOpen(false) }


  const handleCancelBackground = () => { setIsEditBackgroundOpen(false) }

  const handleGenerateSimulation = async () => {
    if (!simulationTitle.trim() || !simulationBrief.trim() || !caseData) return

    setIsGenerating(true)
    try {
      // Call backend to create simulation
      const response = await fetch(`http://localhost:8000/api/v1/simulations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          headline: simulationTitle,
          brief: simulationBrief,
          case_id: Number(id),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create simulation")
      }

      const data = await response.json()
      const newSimulationId = data.id

      // Call continue-conversation endpoint with the new simulation's tree_id
      const conversationResponse = await fetch(`http://localhost:8000/api/v1/continue-conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          case_id: Number(id),
          tree_id: Number(newSimulationId),
          message_id: null,
          refresh: false,
        }),
      })

      if (!conversationResponse.ok) {
        throw new Error("Failed to start conversation")
      }

      const conversationData = await conversationResponse.json()
      console.log("Conversation started:", conversationData)

      // Fetch the tree messages to get the root message ID
      const treeResponse = await fetch(`http://localhost:8000/api/v1/trees/${newSimulationId}/messages`)
      if (!treeResponse.ok) {
        throw new Error("Failed to fetch tree messages")
      }

      const treeMessages = await treeResponse.json()
      const rootMessageId = treeMessages[0]?.id // Get the root message ID

      setIsNewSimulationOpen(false)
      navigate({
        to: "/scenario",
        search: {
          caseId: Number(id),
          simulationId: Number(newSimulationId),
          messageId: rootMessageId
        }
      })
    } catch (err) {
      console.error("Error generating simulation:", err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCancelSimulation = () => {
    setIsNewSimulationOpen(false)
    setSimulationTitle("")
    setSimulationBrief("")
    setIsGenerating(false)
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

      </Box>
    )
  }

  return (
    <Box minHeight="100vh" bg="#F4ECD8" py={8}>
      <Container maxW="1200px">


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
                  Automatic Summary
                </Heading>
                <Text>
                  {caseData.summary}
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Background - Collapsible */}
          <Card.Root width="100%" bg="white">
            <Collapsible.Root>
              <Card.Body>
                <Collapsible.Trigger paddingY={2} flex={1} width="100%">
                  <HStack justifyContent="space-between" width="100%">
                    <Heading fontSize="lg" color="#3A3A3A">
                      Background
                    </Heading>
                    <Text fontSize="sm" color="#999">
                      ▼
                    </Text>
                  </HStack>
                </Collapsible.Trigger>

                <Collapsible.Content>
                  <VStack alignItems="flex-start" gap={4} width="100%" mt={4}>
                    <Box width="100%">
                      <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                        Party A (Our Client)
                      </Text>
                      <Textarea
                        value={caseData.background.party_a}
                        onChange={(e) => {
                          setCaseData({ ...caseData, background: { ...caseData.background, party_a: e.target.value } })
                          setIsBackgroundEdited(true)
                        }}
                        rows={2}
                      />
                    </Box>

                    <Box width="100%">
                      <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                        Party B (Opposing Party)
                      </Text>
                      <Textarea
                        value={caseData.background.party_b}
                        onChange={(e) => {
                          setCaseData({ ...caseData, background: { ...caseData.background, party_b: e.target.value } })
                          setIsBackgroundEdited(true)
                        }}
                        rows={2}
                      />
                    </Box>

                    <Box width="100%">
                      <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                        Key Issues
                      </Text>
                      <Textarea
                        value={caseData.background.key_issues}
                        onChange={(e) => {
                          setCaseData({ ...caseData, background: { ...caseData.background, key_issues: e.target.value } })
                          setIsBackgroundEdited(true)
                        }}
                      />
                    </Box>

         <Box width="100%">
          <HStack justifyContent="space-between" alignItems="center" mb={2}>
            <Text fontSize="sm" fontWeight="medium" color="#3A3A3A">
              General Notes
            </Text>
          <Button
            size="sm"
            variant="outline"
            colorScheme={isRecording ? "red" : "gray"}
            onClick={() => {
              if (isRecording) {
                handleStopRecording()
              } else {
                handleStartRecording()
              }
            }}
          >
            {isRecording ? "Stop Recording" : "🎤 Record"}
          </Button>

          </HStack>

                      <Textarea
                      value={editedBackground.general_notes || ""}
                      onChange={(e) => {
                        setEditedBackground({
                          ...editedBackground,
                          general_notes: e.target.value,
                        })
                        setIsBackgroundEdited(true)
                      }}
                      rows={4}
                    />
                    </Box>

                    {/* Save Button - only show if edited */}
                    {isBackgroundEdited && (
                      <Box width="100%" display="flex" justifyContent="flex-end" mt={2}>
                        <Button
                          bg="#3A3A3A"
                          color="#F4ECD8"
                          _hover={{ bg: "#2A2A2A" }}
                          onClick={handleSaveCase}
                          disabled={saving || !caseData}
                        >
                          {saving ? "Saving..." : "Save"}
                        </Button>
                      </Box>
                    )}
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
                  navigate({
                    to: "/scenario",
                    search: {
                      caseId: Number(id),
                      simulationId: Number(simulation.id),
                    },
                  })
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
                  field === "general_notes" ? (

                      <Box width="100%">
                  <HStack justifyContent="space-between" alignItems="center" mb={2}>
                    <Text fontSize="sm" fontWeight="medium" color="#3A3A3A">
                      General Notes
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme={isRecording ? "red" : "gray"}
                      onClick={() => {
                        if (isRecording) handleStopRecording()
                        else handleStartRecording()
                      }}
                    >
                      {isRecording ? "Stop Recording" : "🎤 Record"}
                    </Button>
                  </HStack>

                  <Textarea
                    value={caseData.background.general_notes} // bind directly to caseData
                    onChange={(e) =>
                      setCaseData({
                        ...caseData,
                        background: {
                          ...caseData.background,
                          general_notes: e.target.value,
                        },
                      })
                    }
                    rows={4}
                  />
                </Box>







                    // <Box width="100%" key={field}>
                    //   <HStack justifyContent="space-between" alignItems="center" mb={2}>
                    //     <Text fontSize="sm" fontWeight="medium" color="#3A3A3A">
                    //       GENERAL NOTES
                    //     </Text>
                    //   <Button
                    //     size="sm"
                    //     variant="outline"
                    //     colorScheme={isRecording ? "red" : "gray"}
                    //     onClick={() => {
                    //       if (isRecording) {
                    //         handleStopRecording()
                    //       } else {
                    //         handleStartRecording()
                    //       }
                    //     }}
                    //   >
                    //     {isRecording ? "Stop Recording" : "🎤 Record"}
                    //   </Button>
                    //   </HStack>
                    //   <Textarea
                    //     value={editedBackground.general_notes}
                    //     onChange={(e) =>
                    //       setEditedBackground({
                    //         ...editedBackground,
                    //         general_notes: e.target.value,
                    //       })
                    //     }
                    //     rows={4}
                    //   />
                    // </Box>
                  ) : (
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
                        rows={field === "key_issues" ? 3 : 2}
                      />
                    </Box>
                  )
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
      <Dialog.Root open={isNewSimulationOpen} onOpenChange={(e: any) => setIsNewSimulationOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px">
            <Dialog.Header>
              <Dialog.Title>New Simulation</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelSimulation}
                  position="absolute"
                  top={4}
                  right={4}
                >
                  ✕
                </Button>
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} alignItems="flex-start" width="100%">
                <Box width="100%">
                  <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                    Title
                  </Text>
                  <Textarea
                    value={simulationTitle}
                    onChange={(e) => setSimulationTitle(e.target.value)}
                    rows={1}
                    placeholder="Enter a title for this simulation"
                    autoFocus
                  />
                </Box>
                <Box width="100%">
                  <Text fontSize="sm" fontWeight="medium" color="#3A3A3A" mb={2}>
                    Brief
                  </Text>
                  <Textarea
                    value={simulationBrief}
                    onChange={(e) => setSimulationBrief(e.target.value)}
                    rows={6}
                    placeholder="Example: Simulate a negotiation about the matrimonial home."
                  />
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                bg="#3A3A3A"
                color="#F4ECD8"
                _hover={{ bg: "#2A2A2A" }}
                onClick={handleGenerateSimulation}
                disabled={!simulationTitle.trim() || !simulationBrief.trim() || isGenerating}
                loading={isGenerating}
                loadingText="Generating..."
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
