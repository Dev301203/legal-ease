// Tree utility functions for converting backend data to frontend DialogueNode structure

import type {
  DialogueNode,
  BackendTreeNode,
  Party,
  TreeMessagesResponse,
} from "@/types/scenario"

/**
 * Map backend role to Party A or B
 * Backend now directly returns "A" or "B" as roles
 * Also supports legacy formats for backward compatibility
 */
export function getPartyFromRole(role: string): Party {
  const normalizedRole = role.toUpperCase().trim()

  // Direct A/B matching (primary format from backend)
  if (normalizedRole === "A") {
    return "A"
  } else if (normalizedRole === "B") {
    return "B"
  }

  // Legacy format support
  const lowerRole = role.toLowerCase()
  if (lowerRole === "user" || lowerRole === "party a") {
    return "A"
  } else if (lowerRole === "assistant" || lowerRole === "party b") {
    return "B"
  }

  // Default to Party A for unknown roles
  return "A"
}

/**
 * Convert a single backend message to DialogueNode
 */
export function messageToDialogueNode(
  message: TreeMessagesResponse,
  includeChildren = true
): DialogueNode {
  const node: DialogueNode = {
    id: String(message.id),
    statement: message.content,
    party: getPartyFromRole(message.role),
    role: message.role,
    selected: message.selected,
    children: [],
  }

  if (includeChildren && message.children) {
    node.children = message.children.map((child) =>
      messageToDialogueNode(child, true)
    )
  }

  return node
}

/**
 * Build full DialogueNode tree from backend messages response
 * @param messages - Array of root messages (should typically be one root)
 * @returns Root DialogueNode
 */
export function buildDialogueTreeFromMessages(
  messages: TreeMessagesResponse[]
): DialogueNode | null {
  if (!messages || messages.length === 0) {
    return null
  }

  // Typically there's one root message (parent_id = null)
  // Convert the first root to DialogueNode
  const root = messageToDialogueNode(messages[0], true)

  // If targetMessageId provided, we can mark paths
  // For now, just return the tree structure
  return root
}

/**
 * Find a specific node in the tree by its ID
 * @param tree - Root DialogueNode
 * @param nodeId - String ID to find
 * @returns DialogueNode if found, null otherwise
 */
export function findNodeInTree(
  tree: DialogueNode | null,
  nodeId: string
): DialogueNode | null {
  if (!tree) return null
  if (tree.id === nodeId) return tree

  // Recursively search children
  for (const child of tree.children) {
    const found = findNodeInTree(child, nodeId)
    if (found) return found
  }

  return null
}

/**
 * Get the selected path from root to a specific node
 * Follows the 'selected' flags in the tree
 * @param tree - Root DialogueNode
 * @returns Array of DialogueNodes representing the conversation history
 */
export function getSelectedPath(tree: DialogueNode | null): DialogueNode[] {
  if (!tree) return []

  const path: DialogueNode[] = [tree]

  // Find the selected child and recurse
  const selectedChild = tree.children.find((child) => child.selected)
  if (selectedChild) {
    path.push(...getSelectedPath(selectedChild))
  }

  return path
}

/**
 * Get path from root to a specific node ID
 * @param tree - Root DialogueNode
 * @param targetId - ID of the target node
 * @returns Array of DialogueNodes from root to target, or empty if not found
 */
export function getPathToNode(
  tree: DialogueNode | null,
  targetId: string
): DialogueNode[] {
  if (!tree) return []
  if (tree.id === targetId) return [tree]

  // Try each child
  for (const child of tree.children) {
    const childPath = getPathToNode(child, targetId)
    if (childPath.length > 0) {
      return [tree, ...childPath]
    }
  }

  return []
}

/**
 * Convert BackendTreeNode (from TreeResponse) to DialogueNode structure
 * Used when merging new branches from continue-conversation API
 */
export function treeNodeToDialogueNode(
  node: BackendTreeNode,
  parentId: string,
  indexInSiblings: number
): DialogueNode {
  // Generate a temporary ID for new nodes (will be replaced with real IDs from backend)
  const nodeId = `${parentId}-child-${indexInSiblings}`

  const dialogueNode: DialogueNode = {
    id: nodeId,
    statement: node.line,
    party: getPartyFromRole(node.speaker),
    role: node.speaker,
    selected: false,
    children: [],
  }

  if (node.responses && node.responses.length > 0) {
    dialogueNode.children = node.responses.map((response, idx) =>
      treeNodeToDialogueNode(response, nodeId, idx)
    )
  }

  return dialogueNode
}

/**
 * Merge new branches from TreeResponse into existing tree at a specific node
 * @param tree - Existing DialogueNode tree
 * @param parentNodeId - ID of the node where new children should be added
 * @param newBranches - BackendTreeNode from API response
 * @returns Updated tree
 */
export function mergeBranchesIntoTree(
  tree: DialogueNode,
  parentNodeId: string,
  newBranches: BackendTreeNode
): DialogueNode {
  if (tree.id === parentNodeId) {
    // Found the parent - add new children
    const newChildren = newBranches.responses.map((response, idx) =>
      treeNodeToDialogueNode(response, parentNodeId, idx)
    )

    return {
      ...tree,
      children: [...tree.children, ...newChildren],
    }
  }

  // Recursively search children
  return {
    ...tree,
    children: tree.children.map((child) =>
      mergeBranchesIntoTree(child, parentNodeId, newBranches)
    ),
  }
}

/**
 * Update selected flags in the tree
 * Marks a specific node and its ancestors as selected
 * @param tree - Root DialogueNode
 * @param targetId - ID of node to mark as selected
 * @returns Updated tree with selected flags
 */
export function updateSelectedPath(
  tree: DialogueNode,
  targetId: string
): DialogueNode {
  const path = getPathToNode(tree, targetId)
  const selectedIds = new Set(path.map((node) => node.id))

  function updateNode(node: DialogueNode): DialogueNode {
    return {
      ...node,
      selected: selectedIds.has(node.id),
      children: node.children.map(updateNode),
    }
  }

  return updateNode(tree)
}

/**
 * Add a custom message node to the tree
 * @param tree - Existing tree
 * @param parentId - Parent node ID
 * @param messageId - New message ID from backend
 * @param content - Message content
 * @param role - Message role
 * @returns Updated tree
 */
export function addCustomMessageToTree(
  tree: DialogueNode,
  parentId: string,
  messageId: number,
  content: string,
  role: string
): DialogueNode {
  if (tree.id === parentId) {
    const newNode: DialogueNode = {
      id: String(messageId),
      statement: content,
      party: getPartyFromRole(role),
      role: role,
      selected: true,
      children: [],
    }

    return {
      ...tree,
      children: [...tree.children, newNode],
    }
  }

  return {
    ...tree,
    children: tree.children.map((child) =>
      addCustomMessageToTree(child, parentId, messageId, content, role)
    ),
  }
}

/**
 * Get the leaf node of the selected path
 * @param tree - Root DialogueNode
 * @returns The last selected node (leaf of selected path)
 */
export function getSelectedLeafNode(tree: DialogueNode | null): DialogueNode | null {
  if (!tree) return null

  const selectedChild = tree.children.find((child) => child.selected)
  if (selectedChild) {
    return getSelectedLeafNode(selectedChild)
  }

  return tree
}

/**
 * Check if a node is a leaf (has no children)
 * @param node - DialogueNode to check
 * @returns true if node has no children
 */
export function isLeafNode(node: DialogueNode | null): boolean {
  return !node || node.children.length === 0
}
