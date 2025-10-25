import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import {
  Box,
  Card,
  Container,
  Heading,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"

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

function SimulationPage() {
  const navigate = useNavigate()
  const { id } = Route.useSearch()
  const [headline, setHeadline] = useState("")
  const [isEditingHeadline, setIsEditingHeadline] = useState(false)
  const [editValue, setEditValue] = useState("")

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

  // Initialize headline state
  const currentHeadline = headline || simulation.headline

  const handleEditHeadline = () => {
    setEditValue(currentHeadline)
    setIsEditingHeadline(true)
  }

  const handleSaveHeadline = () => {
    setHeadline(editValue)
    setIsEditingHeadline(false)
  }

  const handleCancelHeadline = () => {
    setEditValue(currentHeadline)
    setIsEditingHeadline(false)
  }

  return (
    <Box minHeight="100vh" bg="#F4ECD8" py={8}>
      <Container maxW="1200px">
        {/* Back Button */}
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

        {/* Simulation Headline - Editable */}
        <Box mb={6}>
          {isEditingHeadline ? (
            <HStack width="100%" gap={2}>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                size="lg"
                fontSize="3xl"
                fontWeight="semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveHeadline()
                  if (e.key === "Escape") handleCancelHeadline()
                }}
              />
              <IconButton
                size="sm"
                aria-label="Save"
                onClick={handleSaveHeadline}
                colorPalette="green"
              >
                ✓
              </IconButton>
              <IconButton
                size="sm"
                aria-label="Cancel"
                onClick={handleCancelHeadline}
                colorPalette="red"
              >
                ✕
              </IconButton>
            </HStack>
          ) : (
            <HStack
              cursor="pointer"
              onClick={handleEditHeadline}
              _hover={{ bg: "gray.50" }}
              px={2}
              py={1}
              borderRadius="md"
            >
              <Heading fontSize="3xl" fontWeight="semibold" color="#3A3A3A" flex={1}>
                {currentHeadline}
              </Heading>
              <Text fontSize="sm" color="#999">
                ✎
              </Text>
            </HStack>
          )}
        </Box>

        {/* Simulation Details */}
        <VStack alignItems="flex-start" gap={6}>
          {/* Brief */}
          <Card.Root width="100%" bg="white">
            <Card.Body>
              <VStack alignItems="flex-start" gap={3}>
                <Heading fontSize="lg" color="#3A3A3A">
                  Simulation Brief
                </Heading>
                <Text fontSize="md" color="#666" lineHeight="1.6">
                  {simulation.brief}
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Metadata */}
          <Card.Root width="100%" bg="white">
            <Card.Body>
              <HStack gap={6} fontSize="sm" color="#666">
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
            </Card.Body>
          </Card.Root>

          {/* Placeholder for simulation tree visualization */}
          <Card.Root width="100%" bg="white">
            <Card.Body>
              <VStack
                alignItems="center"
                justifyContent="center"
                height="400px"
                gap={4}
              >
                <Text fontSize="4xl" color="#999">
                  🌳
                </Text>
                <Text fontSize="lg" color="#999">
                  Simulation tree visualization coming soon
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>
        </VStack>
      </Container>
    </Box>
  )
}
