// Types for Scenario Explorer / Simulation Page

// Frontend DialogueNode structure (existing in scenario.tsx)
export type Party = "A" | "B"

export interface DialogueNode {
  id: string
  statement: string
  party: Party
  children: DialogueNode[]
  role?: string // Backend role (user, assistant, system)
  selected?: boolean // Track if this node is on the selected path
}

export interface ResponseOption {
  id: string
  text: string
}

// Backend Message structure (from API)
export interface BackendMessage {
  id: number
  content: string
  role: string
  selected: boolean
  children: BackendMessage[]
}

// Backend TreeNode structure (from TreeResponse)
export interface BackendTreeNode {
  speaker: string
  line: string
  level: number
  reflects_personality: string
  responses: BackendTreeNode[]
}

// API response types
export interface TreeMessagesResponse {
  id: number
  role: string
  content: string
  selected: boolean
  children: TreeMessagesResponse[]
}

export interface TreeResponse {
  tree_id: number
  case_id: number
  simulation_goal: string
  scenarios_tree: BackendTreeNode
  error?: string
  raw_response?: string
}

export interface MessageCreateRequest {
  tree_id: number
  parent_id: number | null
  content: string
  role: string
}

export interface MessageCreateResponse {
  id: number
  content: string
  role: string
  selected: boolean
  simulation_id: number
  parent_id: number | null
}

export interface ContinueConversationRequest {
  case_id: number
  tree_id: number | null
  simulation_goal: string
}

// Simulation metadata
export interface SimulationMetadata {
  id: number
  headline: string
  brief: string
  created_at: string
  node_count: number
}

// Loading states
export interface ScenarioLoadingState {
  isLoadingTree: boolean
  isGeneratingResponses: boolean
  error: string | null
}

// URL parameters
export interface ScenarioSearchParams {
  caseId: number
  simulationId: number
  messageId?: number
}
