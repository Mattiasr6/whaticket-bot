import React, { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  makeStyles,
} from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  form: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    minWidth: 480,
  },
}));

const TYPE_OPTIONS = [
  { value: "menu", label: "Menú" },
  { value: "message", label: "Mensaje" },
  { value: "redirect", label: "Redirigir" },
];

const FlowNodeModal = ({
  open,
  onClose,
  onSave,
  editingNode,
  parentNode,
  allNodes,
  botId,
}) => {
  const classes = useStyles();

  const isRoot = !parentNode && !editingNode;
  const isEditing = !!editingNode;

  const [form, setForm] = useState({
    title: "",
    type: "message",
    content: "",
    triggerKeywords: "",
    redirectToNodeId: "",
  });

  useEffect(() => {
    if (editingNode) {
      setForm({
        title: editingNode.title || "",
        type: editingNode.type || "message",
        content: editingNode.content || "",
        triggerKeywords: editingNode.triggerKeywords || "",
        redirectToNodeId: editingNode.redirectToNodeId || "",
      });
    } else if (parentNode) {
      setForm({
        title: "",
        type: "message",
        content: "",
        triggerKeywords: "",
        redirectToNodeId: "",
      });
    } else {
      setForm({
        title: "",
        type: "menu",
        content: "",
        triggerKeywords: "",
        redirectToNodeId: "",
      });
    }
  }, [editingNode, parentNode, open]);

  const getAvailableRedirectNodes = () => {
    return allNodes.filter((n) => n.id !== editingNode?.id);
  };

  const handleSave = () => {
    if (!form.title) return;
    const payload = {
      title: form.title,
      type: form.type,
      content: form.content,
    };
    if (form.type === "redirect") {
      payload.redirectToNodeId = form.redirectToNodeId || null;
    }
    if (isRoot || (!parentNode && !editingNode)) {
      payload.triggerKeywords = form.triggerKeywords;
    }
    onSave(payload);
  };

  const parentTitle = parentNode ? parentNode.title : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md">
      <DialogTitle>
        {isEditing
          ? "Editar Opción"
          : isRoot
          ? "Nueva Opción Inicial"
          : `Nueva Opción${parentTitle ? ` (en "${parentTitle}")` : ""}`}
      </DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <TextField
            label="Título de la Opción"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            fullWidth
            margin="dense"
            required
          />

          <FormControl fullWidth margin="dense">
            <InputLabel>Tipo</InputLabel>
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              disabled={isEditing && editingNode?.type === "menu" && !editingNode?.parentId}
            >
              {TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {isEditing && editingNode?.type === "menu" && !editingNode?.parentId && (
              <FormHelperText>
                El tipo de la opción inicial no se puede cambiar
              </FormHelperText>
            )}
          </FormControl>

          <TextField
            label="Mensaje"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            fullWidth
            multiline
            rows={4}
            margin="dense"
            placeholder={
              form.type === "menu"
                ? "Describe las opciones del menú (se numerarán automáticamente)"
                : "Escribe el mensaje a enviar"
            }
          />

          {isRoot && (
            <TextField
              label="Palabras de Activación"
              value={form.triggerKeywords}
              onChange={(e) =>
                setForm({ ...form, triggerKeywords: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
              margin="dense"
              placeholder="palabra1&#10;palabra2"
              helperText="Solo la opción inicial puede tener palabras de activación"
            />
          )}

          {form.type === "redirect" && (
            <FormControl fullWidth margin="dense">
              <InputLabel>Redirigir a</InputLabel>
              <Select
                value={form.redirectToNodeId}
                onChange={(e) =>
                  setForm({ ...form, redirectToNodeId: e.target.value })
                }
              >
                <MenuItem value="">
                  <em>-- Seleccionar --</em>
                </MenuItem>
                {getAvailableRedirectNodes().map((n) => (
                  <MenuItem key={n.id} value={n.id}>
                    {n.title} ({n.type})
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Selecciona la opción de destino para redirigir
              </FormHelperText>
            </FormControl>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={!form.title}
        >
          {isEditing ? "Actualizar" : "Crear"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FlowNodeModal;
