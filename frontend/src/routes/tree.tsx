
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
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import axios from 'axios';
import dagre from 'dagre';
import { useNavigate, useSearch } from '@tanstack/react-router';

const fitViewOptions: FitViewOptions = { padding: 0.2 };
const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: false,
  style: { stroke: '#C0C0C0', strokeWidth: 1 } // Light-medium grey, continuous
};

const onNodeDrag: OnNodeDrag = (_, node) => {
  console.log('drag event', node.data);
};

// Dagre layout configuration
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 250;
const nodeHeight = 80;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  // Increased spacing: ranksep controls vertical spacing between levels, nodesep controls horizontal spacing between siblings
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 150, nodesep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface MessageNode {
  id: number;
  role: string;
  content: string;
  children: MessageNode[];
}

function Flow({ simulationId }: { simulationId: number }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { caseId?: number; simulationId?: number; messageId?: number };
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

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const messageIdNum = Number(node.id);
      // Update URL with messageId parameter
      if (search.caseId) {
        navigate({
          to: '/scenario',
          search: {
            caseId: search.caseId,
            simulationId: simulationId,
            messageId: messageIdNum,
          },
        });
      }
    },
    [navigate, search.caseId, simulationId]
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

        function traverseTree(node: MessageNode, parentId?: string) {
          const nodeId = node.id.toString();
          const isBookmarked = bookmarkedIds.has(nodeId);
          const isInBookmarkPath = highlightedIds.has(nodeId);
          const isRoot = !parentId;

          // Role-based border colors (salmon/slate pattern from scenario.tsx)
          const borderColor =
            node.role === 'B' ? '#9FA0C3' :      // slate.500
            node.role === 'A' ? '#E07A5F' : // salmon.500
            node.role === 'system' ? '#9FA0C3' :    // slate.500
            '#888';

          // Bold borders for: root nodes, bookmarked nodes, or nodes in bookmark paths
          const borderWidth = (isRoot || isBookmarked || isInBookmarkPath) ? '4px' : '2px';

          // Fill root and bookmarked nodes with their border color
          const backgroundColor = (isRoot || isBookmarked) ? borderColor : 'white';

          // White bold text for root and bookmarked nodes
          const textColor = (isRoot || isBookmarked) ? 'white' : '#3A3A3A';
          const fontWeight = (isRoot || isBookmarked) ? 'bold' : 'normal';

          newNodes.push({
            id: nodeId,
            data: { label: `${node.role}: ${node.content}` },
            position: { x: 0, y: 0 }, // Temporary position, will be set by dagre
            style: {
              background: backgroundColor,
              color: textColor,
              fontWeight: fontWeight,
              padding: 10,
              borderRadius: 5,
              border: `${borderWidth} solid ${borderColor}`,
              cursor: 'pointer',
            },
          });

          if (parentId) {
            // Emphasized edges for bookmark paths: darker, animated, dotted
            if (isInBookmarkPath) {
              newEdges.push({
                id: `${parentId}-${nodeId}`,
                source: parentId,
                target: nodeId,
                animated: true,
                style: {
                  stroke: '#333',
                  strokeWidth: 3,
                  strokeDasharray: '5,5',
                },
              });
            } else {
              // Default edges are handled by defaultEdgeOptions
              newEdges.push({
                id: `${parentId}-${nodeId}`,
                source: parentId,
                target: nodeId,
              });
            }
          }

          node.children.forEach(child => traverseTree(child, nodeId));
        }

        treeData.forEach(rootNode => traverseTree(rootNode));

        // Apply dagre layout
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
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
      onNodeClick={onNodeClick}
      fitView
      fitViewOptions={fitViewOptions}
      defaultEdgeOptions={defaultEdgeOptions}
      minZoom={0.1}
      maxZoom={2}
    />
  );
}

export default Flow;
