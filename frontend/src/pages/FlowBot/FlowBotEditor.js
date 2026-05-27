import React, { useState, useEffect, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";
import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  Typography,
  Tooltip,
  Breadcrumbs,
  Link,
  Chip,
  Collapse,
  CircularProgress,
} from "@material-ui/core";
import {
  ArrowBack,
  AddCircleOutline,
  Edit,
  DeleteOutline,
  KeyboardArrowUp,
  KeyboardArrowDown,
  ExpandMore,
  ChevronRight,
  Visibility,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import ConfirmationModal from "../../components/ConfirmationModal";
import FlowNodeModal from "./FlowNodeModal";
import FlowBotPreview from "./FlowBotPreview";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  breadcrumbBar: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1, 0),
    marginBottom: theme.spacing(1),
  },
  treeContainer: {
    padding: theme.spacing(1, 0),
  },
  nodeRow: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    margin: theme.spacing(0.25, 0),
  },
  nodeIcon: {
    marginRight: theme.spacing(1),
    fontSize: 20,
  },
  nodeTitle: {
    flex: 1,
    cursor: "pointer",
    fontWeight: 500,
  },
  nodeTypeChip: {
    marginRight: theme.spacing(1),
    height: 22,
  },
  nodeActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    opacity: 0.3,
    "&:hover": {
      opacity: 1,
    },
  },
  childrenContainer: {
    marginLeft: theme.spacing(4),
    borderLeft: `2px solid ${theme.palette.divider}`,
    paddingLeft: theme.spacing(1),
  },
  levelBadge: {
    marginRight: theme.spacing(1),
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  emptyState: {
    textAlign: "center",
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  previewFab: {
    position: "fixed",
    bottom: theme.spacing(3),
    right: theme.spacing(3),
  },
  headerActions: {
    display: "flex",
    gap: theme.spacing(1),
  },
}));

const TYPE_ICONS = {
  menu: "\uD83D\uDCC1",
  message: "\uD83D\uDCC4",
  redirect: "\uD83D\uDD04",
};

const TYPE_LABELS = {
  menu: "Menú",
  message: "Mensaje",
  redirect: "Redirigir",
};

const TreeNode = ({
  node,
  allNodes,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddChild,
  onMoveUp,
  onMoveDown,
  siblings,
  level,
}) => {
  const classes = useStyles();
  const hasChildren = allNodes.some((n) => n.parentId === node.id);
  const isExpanded = expanded.has(node.id);

  return (
    <div>
      <div className={classes.nodeRow}>
        <span className={classes.levelBadge}>L{level}</span>

        {hasChildren ? (
          <IconButton size="small" onClick={() => onToggle(node.id)}>
            {isExpanded ? <ExpandMore /> : <ChevronRight />}
          </IconButton>
        ) : (
          <span style={{ width: 36 }} />
        )}

        <span className={classes.nodeIcon}>{TYPE_ICONS[node.type]}</span>

        <span className={classes.nodeTitle} onClick={() => onToggle(node.id)}>
          {node.title}
        </span>

        <Chip
          label={TYPE_LABELS[node.type] || node.type}
          size="small"
          className={classes.nodeTypeChip}
          variant="outlined"
          color={node.type === "menu" ? "primary" : "default"}
        />

        <div className={classes.nodeActions}>
          {level < 3 && (
            <Tooltip title="Agregar sub-opción">
              <IconButton size="small" onClick={() => onAddChild(node)}>
                <AddCircleOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEdit(node)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" onClick={() => onDelete(node)}>
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Subir">
            <span>
              <IconButton
                size="small"
                onClick={() => onMoveUp(node)}
                disabled={siblings.indexOf(node) === 0}
              >
                <KeyboardArrowUp fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Bajar">
            <span>
              <IconButton
                size="small"
                onClick={() => onMoveDown(node)}
                disabled={siblings.indexOf(node) === siblings.length - 1}
              >
                <KeyboardArrowDown fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </div>

      {hasChildren && (
        <Collapse in={isExpanded}>
          <div className={classes.childrenContainer}>
            {allNodes
              .filter((n) => n.parentId === node.id)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((child) => (
                <TreeNode
                  key={child.id}
                  node={child}
                  allNodes={allNodes}
                  expanded={expanded}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  siblings={allNodes
                    .filter((n) => n.parentId === child.parentId)
                    .sort((a, b) => a.sortOrder - b.sortOrder)}
                  level={level + 1}
                />
              ))}
          </div>
        </Collapse>
      )}
    </div>
  );
};

const FlowBotEditor = () => {
  const classes = useStyles();
  const { id } = useParams();
  const history = useHistory();

  const [bot, setBot] = useState(null);
  const [allNodes, setAllNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [parentNode, setParentNode] = useState(null);
  const [deletingNode, setDeletingNode] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fetching, setFetching] = useState(false);

  const fetchBot = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/flow-bots/${id}`);
      setBot(data);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  }, [id]);

  const fetchAllNodes = useCallback(async () => {
    setFetching(true);
    try {
      const { data } = await api.get(`/flow-bots/${id}/nodes`);
      const nodesList = Array.isArray(data) ? data : data.nodes || [];
      setAllNodes(nodesList);
    } catch (err) {
      toastError(err);
    }
    setFetching(false);
  }, [id]);

  useEffect(() => {
    fetchBot();
  }, [fetchBot]);

  useEffect(() => {
    if (bot) {
      fetchAllNodes();
    }
  }, [bot, fetchAllNodes]);

  const rootNodes = allNodes
    .filter((n) => !n.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const handleToggle = (nodeId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleAddChild = (parent) => {
    setParentNode(parent);
    setEditingNode(null);
    setNodeModalOpen(true);
  };

  const handleEdit = (node) => {
    setParentNode(null);
    setEditingNode(node);
    setNodeModalOpen(true);
  };

  const handleDelete = (node) => {
    setDeletingNode(node);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingNode) return;
    try {
      await api.delete(`/flow-nodes/${deletingNode.id}`);
      toast.success("Opción eliminada");
      setConfirmOpen(false);
      setDeletingNode(null);
      fetchAllNodes();
    } catch (err) {
      toastError(err);
    }
  };

  const handleNodeSave = async (formData) => {
    try {
      if (editingNode) {
        await api.put(`/flow-nodes/${editingNode.id}`, formData);
        toast.success("Opción actualizada");
      } else {
        await api.post(`/flow-bots/${id}/nodes`, {
          ...formData,
          parentId: parentNode ? parentNode.id : null,
        });
        toast.success("Opción creada");
      }
      setNodeModalOpen(false);
      setEditingNode(null);
      setParentNode(null);
      fetchAllNodes();
    } catch (err) {
      toastError(err);
    }
  };

  const reorderSiblings = async (node, direction) => {
    const siblings = allNodes
      .filter((n) => n.parentId === node.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = siblings.indexOf(node);
    if (
      (direction === "up" && idx <= 0) ||
      (direction === "down" && idx >= siblings.length - 1)
    )
      return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newOrders = siblings.map((s) => s.sortOrder);
    [newOrders[idx], newOrders[swapIdx]] = [newOrders[swapIdx], newOrders[idx]];

    try {
      await api.put(`/flow-nodes/${node.id}/order`, {
        ids: siblings.map((s) => s.id),
        orders: newOrders,
      });
      fetchAllNodes();
    } catch (err) {
      toastError(err);
    }
  };

  const handleMoveUp = async (node) => reorderSiblings(node, "up");
  const handleMoveDown = async (node) => reorderSiblings(node, "down");

  const handleAddRoot = () => {
    setParentNode(null);
    setEditingNode(null);
    setNodeModalOpen(true);
  };

  if (loading) {
    return (
      <MainContainer>
        <div style={{ textAlign: "center", padding: 40 }}>
          <CircularProgress />
        </div>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <ConfirmationModal
        title={`¿Eliminar opción "${deletingNode?.title || ""}"?`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
      >
        Esto eliminará permanentemente esta opción y todas sus sub-opciones.
      </ConfirmationModal>

      <FlowNodeModal
        open={nodeModalOpen}
        onClose={() => {
          setNodeModalOpen(false);
          setEditingNode(null);
          setParentNode(null);
        }}
        onSave={handleNodeSave}
        editingNode={editingNode}
        parentNode={parentNode}
        allNodes={allNodes}
        botId={id}
      />

      <FlowBotPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        botId={id}
      />

      <MainHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconButton size="small" onClick={() => history.push("/flow-bots")}>
            <ArrowBack />
          </IconButton>
          <Title>
            {bot ? `Árbol del Bot: ${bot.name}` : "Árbol del Bot"}
          </Title>
        </div>
        <MainHeaderButtonsWrapper>
          <div className={classes.headerActions}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Visibility />}
              onClick={() => setPreviewOpen(true)}
            >
              Probar Bot
            </Button>
            {rootNodes.length === 0 && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddCircleOutline />}
                onClick={handleAddRoot}
              >
                Agregar opción inicial
              </Button>
            )}
          </div>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        {rootNodes.length === 0 && !fetching && (
          <div className={classes.emptyState}>
            <Typography variant="body1" gutterBottom>
              Aún no hay opciones. Crea una opción inicial para empezar a construir tu bot.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddCircleOutline />}
              onClick={handleAddRoot}
            >
              Agregar opción inicial
            </Button>
          </div>
        )}

        {fetching && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <CircularProgress size={24} />
          </div>
        )}

        {!fetching && rootNodes.length > 0 && (
          <div className={classes.treeContainer}>
            {rootNodes.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                allNodes={allNodes}
                expanded={expanded}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddChild={handleAddChild}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                siblings={rootNodes}
                level={1}
              />
            ))}
          </div>
        )}
      </Paper>
    </MainContainer>
  );
};

export default FlowBotEditor;
