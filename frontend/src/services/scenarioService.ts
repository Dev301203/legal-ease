// API service layer for Scenario Explorer
// Uses generated API client and environment variables

import type {
  TreeMessagesResponse,
  TreeResponse,
  MessageCreateResponse,
} from "@/types/scenario"
import { DefaultService } from "../client"

// For endpoints not yet in the generated client
const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1`

/**
 * Load the full message tree for a simulation
 * @param simulationId - The simulation/tree ID
 * @returns Hierarchical message structure
 * @throws Error if simulation not found or network error
 */
export async function loadSimulationTree(
  simulationId: number
): Promise<TreeMessagesResponse[]> {
  return await DefaultService.getTreeMessagesEndpoint({ simulationId })
}

/**
 * Continue the conversation by generating new response options
 * @param caseId - The case ID
 * @param messageId - The message ID of the last selected node (leaf node)
 * @param treeId - The simulation/tree ID
 * @param refresh - Whether to regenerate existing children (default: false)
 * @returns TreeResponse with new branches
 * @throws Error if case not found or generation fails
 */
export async function continueConversation(
  caseId: number,
  messageId: number,
  treeId: number,
  refresh: boolean = false
): Promise<TreeResponse> {
  // Note: Generated client types don't include message_id and refresh yet
  // Using fetch directly until OpenAPI spec is updated
  const response = await fetch(`${API_BASE}/continue-conversation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      case_id: caseId,
      message_id: messageId,
      tree_id: treeId,
      refresh,
    }),
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Case not found")
    }
    throw new Error(`Failed to continue conversation: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Create a custom user message in the tree
 * @param treeId - The simulation/tree ID
 * @param parentId - Parent message ID (null for root)
 * @param content - Message content
 * @param role - Message role (typically "user" for custom responses)
 * @returns Created message with ID
 * @throws Error if creation fails
 */
export async function createCustomMessage(
  simulationId: number,
  parentId: number | null,
  content: string,
  role: string = "user"
): Promise<MessageCreateResponse> {
  return await DefaultService.createMessage({
    requestBody: {
      simulation_id: simulationId,
      parent_id: parentId,
      user_input: content,
      role,
      desired_length: 15, // Summarize to 15 words
    },
  })
}

/**
 * Mark a message as selected in the conversation path
 * @param messageId - The message ID to select
 * @throws Error if selection fails
 */
export async function selectMessage(messageId: number): Promise<void> {
  await DefaultService.selectMessage({ messageId })
}

/**
 * Get children messages for a specific message
 * @param messageId - Parent message ID
 * @returns Array of child messages
 * @throws Error if fetch fails
 */
export async function getMessageChildren(messageId: number): Promise<any[]> {
  return await DefaultService.getChildren({ messageId })
}

/**
 * Delete messages after a specific point (for regeneration)
 * @param messageId - Message ID to trim after
 * @throws Error if deletion fails
 */
export async function trimMessagesAfter(messageId: number): Promise<void> {
  await DefaultService.trimMessagesAfterChildren({ messageId })
}

/**
 * Get audio for a conversation tree
 * @param simulationId - The simulation ID
 * @param messageId - The end message ID
 * @returns Audio file response
 * @throws Error if audio generation fails
 */
export async function getConversationAudio(simulationId: number, messageId: number): Promise<Blob> {
  return await DefaultService.getConversationAudio({
    simulationId,
    endMessageId: messageId
  })
}

/**
 * Get case details including simulations
 * @param caseId - The case ID
 * @returns Case data with simulations
 * @throws Error if case not found
 */
export async function getCaseWithSimulations(caseId: number): Promise<any> {
  return await DefaultService.getCaseWithSimulations({ caseId })
}

/**
 * Get simulation details by ID
 * @param simulationId - The simulation ID
 * @returns Simulation details including headline, brief, created_at, case_id
 * @throws Error if simulation not found
 */
export async function getSimulation(simulationId: number): Promise<{
  id: number
  headline: string
  brief: string
  created_at: string
  case_id: number
}> {
  const response = await fetch(`${API_BASE}/simulations/${simulationId}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Simulation not found")
    }
    throw new Error(`Failed to get simulation: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Create a new bookmark
 * @param simulationId - The simulation ID
 * @param messageId - The message ID to bookmark
 * @param name - The name for the bookmark
 * @returns Created bookmark
 * @throws Error if bookmark creation fails
 */
export async function createBookmark(
  simulationId: number,
  messageId: number,
  name: string
): Promise<{
  id: number
  simulation_id: number
  message_id: number
  name: string
}> {
  const response = await fetch(`${API_BASE}/bookmarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      simulation_id: simulationId,
      message_id: messageId,
      name,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create bookmark: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Get all bookmarks for a simulation
 * @param simulationId - The simulation ID
 * @returns Array of bookmarks
 * @throws Error if fetch fails
 */
export async function getBookmarks(simulationId: number): Promise<
  Array<{
    id: number
    simulation_id: number
    message_id: number
    name: string
  }>
> {
  const response = await fetch(`${API_BASE}/bookmarks/${simulationId}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Simulation not found")
    }
    throw new Error(`Failed to get bookmarks: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Delete a bookmark by ID
 * @param bookmarkId - The bookmark ID to delete
 * @throws Error if deletion fails
 */
export async function deleteBookmark(bookmarkId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/bookmarks/${bookmarkId}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    throw new Error(`Failed to delete bookmark: ${response.statusText}`)
  }
}
