// API service layer for Scenario Explorer
// Uses direct fetch calls to backend API

import type {
  TreeMessagesResponse,
  TreeResponse,
  MessageCreateResponse,
} from "@/types/scenario"

const API_BASE = "http://localhost:8000/api/v1"

/**
 * Load the full message tree for a simulation
 * @param simulationId - The simulation/tree ID
 * @returns Hierarchical message structure
 * @throws Error if simulation not found or network error
 */
export async function loadSimulationTree(
  simulationId: number
): Promise<TreeMessagesResponse[]> {
  const response = await fetch(`${API_BASE}/trees/${simulationId}/messages`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Simulation not found")
    }
    throw new Error(`Failed to load simulation tree: ${response.statusText}`)
  }

  return await response.json()
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
  treeId: number,
  parentId: number | null,
  content: string,
  role: string = "user"
): Promise<MessageCreateResponse> {
  const response = await fetch(`${API_BASE}/messages/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tree_id: treeId,
      parent_id: parentId,
      content,
      role,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create message: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Mark a message as selected in the conversation path
 * @param messageId - The message ID to select
 * @throws Error if selection fails
 */
export async function selectMessage(messageId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/messages/${messageId}/select`, {
    method: "PATCH",
  })

  if (!response.ok) {
    throw new Error(`Failed to select message: ${response.statusText}`)
  }
}

/**
 * Get children messages for a specific message
 * @param messageId - Parent message ID
 * @returns Array of child messages
 * @throws Error if fetch fails
 */
export async function getMessageChildren(messageId: number): Promise<any[]> {
  const response = await fetch(`${API_BASE}/messages/${messageId}/children`)

  if (!response.ok) {
    throw new Error(`Failed to get message children: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Delete messages after a specific point (for regeneration)
 * @param messageId - Message ID to trim after
 * @throws Error if deletion fails
 */
export async function trimMessagesAfter(messageId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/messages/trim-after/${messageId}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    throw new Error(`Failed to trim messages: ${response.statusText}`)
  }
}

/**
 * Get audio for a conversation tree
 * @param treeId - The simulation/tree ID
 * @returns Audio file response
 * @throws Error if audio generation fails
 */
export async function getConversationAudio(treeId: number): Promise<Blob> {
  const response = await fetch(`${API_BASE}/get-conversation-audio/${treeId}`)

  if (!response.ok) {
    throw new Error(`Failed to get conversation audio: ${response.statusText}`)
  }

  return await response.blob()
}

/**
 * Get case details including simulations
 * @param caseId - The case ID
 * @returns Case data with simulations
 * @throws Error if case not found
 */
export async function getCaseWithSimulations(caseId: number): Promise<any> {
  const response = await fetch(`${API_BASE}/cases/${caseId}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Case not found")
    }
    throw new Error(`Failed to get case: ${response.statusText}`)
  }

  return await response.json()
}
