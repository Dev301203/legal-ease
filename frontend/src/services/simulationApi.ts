import { OpenAPI } from "@/client"
import axios from "axios"

const apiClient = axios.create({
  baseURL: OpenAPI.BASE,
  headers: {
    "Content-Type": "application/json",
  },
})

export interface TreeNode {
  speaker: string
  line: string
  level: number
  reflects_personality: string
  responses: TreeNode[]
}

export interface TreeResponse {
  tree_id: number | null
  case_id: number
  simulation_goal: string
  scenarios_tree: TreeNode
  error?: string | null
  raw_response?: string | null
}

export interface ContinueConversationRequest {
  case_id: number
  tree_id?: number | null
  simulation_goal?: string
}

export async function continueConversation(
  request: ContinueConversationRequest
): Promise<TreeResponse> {
  try {
    const response = await apiClient.post<TreeResponse>(
      "/api/v1/continue-conversation",
      request
    )
    return response.data
  } catch (error) {
    console.error("Error continuing conversation:", error)
    throw error
  }
}

export interface Message {
  id: number
  content: string
  role: string
  selected: boolean
  parent_id: number | null
  tree_id: number
  children?: Message[]
}

export async function getTreeMessages(treeId: number): Promise<Message[]> {
  try {
    const response = await apiClient.get<Message[]>(
      `/api/v1/trees/${treeId}/messages`
    )
    return response.data
  } catch (error) {
    console.error("Error getting tree messages:", error)
    throw error
  }
}

export async function selectMessage(messageId: number): Promise<Message> {
  try {
    const response = await apiClient.patch<Message>(
      `/api/v1/messages/${messageId}/select`
    )
    return response.data
  } catch (error) {
    console.error("Error selecting message:", error)
    throw error
  }
}

export async function getConversationAudio(treeId: number): Promise<Blob> {
  try {
    const response = await apiClient.get(
      `/api/v1/get-conversation-audio/${treeId}`,
      { responseType: "blob" }
    )
    return response.data
  } catch (error) {
    console.error("Error getting conversation audio:", error)
    throw error
  }
}

export interface CreateMessageRequest {
  tree_id: number
  parent_id: number | null
  content: string
  role: string
}

export async function createMessage(
  request: CreateMessageRequest
): Promise<Message> {
  try {
    const response = await apiClient.post<Message>(
      "/api/v1/messages/create",
      request
    )
    return response.data
  } catch (error) {
    console.error("Error creating message:", error)
    throw error
  }
}

