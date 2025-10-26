
import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type FitViewOptions,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type OnNodeDrag,
  type DefaultEdgeOptions,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import axios from 'axios';

const fitViewOptions: FitViewOptions = { padding: 0.2 };
const defaultEdgeOptions: DefaultEdgeOptions = { animated: true };

const onNodeDrag: OnNodeDrag = (_, node) => {
  console.log('drag event', node.data);
};

interface MessageNode {
  id: number;
  role: string;
  content: string;
  children: MessageNode[];
}

function Flow({ simulationId }: { simulationId: number }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  // Fetch bookmark paths
  useEffect(() => {
    async function fetchBookmarksAndPaths() {
      try {
        const response = await axios.get<{ message_id: number }[]>(
          `http://localhost:8000/api/v1/bookmarks/${simulationId}`
        );
        const bookmarkIds = response.data.map(b => b.message_id.toString());
        const bookmarkIdsSet = new Set<string>(bookmarkIds);
        setBookmarkedIds(bookmarkIdsSet);

        const pathIds = new Set<string>();
        await Promise.all(bookmarkIds.map(async (id) => {
          const res = await axios.get<{ id: number }[]>(
            `http://localhost:8000/api/v1/trees/${simulationId}/messages/traversal?message_id=${id}`
          );
          res.data.forEach(m => pathIds.add(m.id.toString()));
        }));

        setHighlightedIds(pathIds);
      } catch (err) {
        console.error('Failed to fetch bookmarks or paths', err);
      }
    }
    fetchBookmarksAndPaths();
  }, [simulationId]);

  // Fetch full tree and build nodes/edges
  useEffect(() => {
    async function fetchMessages() {
      try {
        const response = await axios.get<MessageNode[]>(
          `http://localhost:8000/api/v1/trees/${simulationId}/messages`
        );
        const treeData = response.data;

        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        let yCounter = 0;

        function traverseTree(node: MessageNode, x: number, parentId?: string) {
          const nodeId = node.id.toString();
          const isHighlighted = bookmarkedIds.has(nodeId);
          const isHighlightedEdge = highlightedIds.has(nodeId);

          const bgColor =
            node.role === 'assistant' ? '#F4E1B9' :
            node.role === 'user' ? '#d5ac62' :
            node.role === 'system' ? '#F7F0D6' :
            '#e0e0e0';

          const y = yCounter * 50;
          yCounter++;

          newNodes.push({
            id: nodeId,
            data: { label: `${node.role}: ${node.content}` },
            position: { x, y },
            style: {
              background: bgColor,
              color: 'black',
              padding: 10,
              borderRadius: 5,
              border: isHighlighted ? '2px solid gold' : '1px solid #ccc',
              boxShadow: isHighlighted ? '0 0 10px 2px rgba(255, 215, 0, 0.6)' : undefined,
            },
          });

          if (parentId) {
            newEdges.push({
              id: `${parentId}-${nodeId}`,
              source: parentId,
              target: nodeId,
              style: isHighlightedEdge ? { stroke: 'gold', strokeWidth: 3 } : { stroke: '#888', strokeWidth: 1 },
            });
          }

          node.children.forEach(child => traverseTree(child, x + 200, nodeId));
        }

        treeData.forEach(rootNode => traverseTree(rootNode, 0));

        setNodes(newNodes);
        setEdges(newEdges);
      } catch (err) {
        console.error('Failed to fetch messages', err);
      }
    }

    fetchMessages();
  }, [simulationId, highlightedIds]);

  return (
    <ReactFlow
      style={{ width: '100%', height: '100%' }}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeDrag={onNodeDrag}
      fitView
      fitViewOptions={fitViewOptions}
      defaultEdgeOptions={defaultEdgeOptions}
    />
  );
}

export default Flow;
