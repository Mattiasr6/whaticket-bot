import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Tooltip,
  Chip
} from "@material-ui/core";
import {
  Edit,
  DeleteOutline,
  AccountTree,
  FileCopy,
  Visibility
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    minWidth: 450,
  },
}));

const FlowBotList = () => {
  const classes = useStyles();
  const history = useHistory();
  const { whatsApps } = useContext(WhatsAppsContext);

  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    whatsappId: "",
    triggerKeywords: "",
    enabled: true,
  });

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/flow-bots");
      setBots(Array.isArray(data) ? data : data.bots || []);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  const getWhatsAppName = (whatsappId) => {
    const w = whatsApps.find((wa) => wa.id === whatsappId);
    return w ? `${w.name} (${w.status})` : `#${whatsappId}`;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      whatsappId: whatsApps.length > 0 ? whatsApps[0].id : "",
      triggerKeywords: "",
      enabled: true,
    });
    setModalOpen(true);
  };

  const openEdit = (bot) => {
    setEditing(bot);
    setForm({
      name: bot.name,
      whatsappId: bot.whatsappId || "",
      triggerKeywords: bot.triggerKeywords || "",
      enabled: bot.enabled,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.warn("El nombre del bot es obligatorio");
      return;
    }
    if (!form.whatsappId) {
      toast.warn("La conexión de WhatsApp es obligatoria");
      return;
    }
    try {
      if (editing) {
        await api.put(`/flow-bots/${editing.id}`, form);
        toast.success("Bot actualizado");
      } else {
        await api.post("/flow-bots", form);
        toast.success("Bot creado");
      }
      setModalOpen(false);
      fetchBots();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/flow-bots/${deleting.id}`);
      toast.success("Bot eliminado");
      setConfirmOpen(false);
      setDeleting(null);
      fetchBots();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDuplicate = async (botId) => {
    try {
      await api.post(`/flow-bots/${botId}/duplicate`);
      toast.success("Bot duplicado");
      fetchBots();
    } catch (err) {
      toastError(err);
    }
  };

  const handleToggleEnabled = async (bot) => {
    try {
      await api.put(`/flow-bots/${bot.id}`, {
        enabled: !bot.enabled,
      });
      fetchBots();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={`¿Eliminar "${deleting?.name || ""}"?`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      >
        Esto eliminará permanentemente el bot y todas sus opciones.
      </ConfirmationModal>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md">
        <DialogTitle>
          {editing ? "Editar Bot" : "Nuevo Bot Conversacional"}
        </DialogTitle>
        <DialogContent>
          <div className={classes.form}>
            <TextField
              label="Nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              margin="dense"
            />

            <FormControl fullWidth margin="dense">
              <InputLabel>Conexión WhatsApp</InputLabel>
              <Select
                value={form.whatsappId}
                onChange={(e) =>
                  setForm({ ...form, whatsappId: e.target.value })
                }
              >
                {whatsApps.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name} ({w.status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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
              placeholder="palabra1&#10;palabra2&#10;palabra3"
              helperText="Los mensajes que contengan estas palabras activarán el bot"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm({ ...form, enabled: e.target.checked })
                  }
                />
              }
              label="Activado"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} color="secondary">
            Cancelar
          </Button>
          <Button onClick={handleSave} color="primary" variant="contained">
            {editing ? "Actualizar" : "Crear"}
          </Button>
        </DialogActions>
      </Dialog>

      <MainHeader>
        <Title>Bots Conversacionales</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            onClick={openCreate}
          >
            + Nuevo Bot
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">Nombre</TableCell>
              <TableCell align="center">WhatsApp</TableCell>
              <TableCell align="center">Activo</TableCell>
              <TableCell align="center"># Opciones</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bots.map((bot) => (
              <TableRow key={bot.id}>
                <TableCell align="center">{bot.name}</TableCell>
                <TableCell align="center">
                  {getWhatsAppName(bot.whatsappId)}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title={bot.enabled ? "Activado" : "Desactivado"}>
                    <span
                      style={{
                        color: bot.enabled ? "green" : "gray",
                        fontWeight: "bold",
                      }}
                    >
                      {bot.enabled ? "SÍ" : "NO"}
                    </span>
                  </Tooltip>
                  <Switch
                    size="small"
                    checked={bot.enabled}
                    onChange={() => handleToggleEnabled(bot)}
                  />
                </TableCell>
                <TableCell align="center">
                  {bot.nodesCount !== undefined ? bot.nodesCount : "-"}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Editar árbol">
                    <IconButton
                      size="small"
                      onClick={() =>
                        history.push(`/flow-bots/${bot.id}/edit`)
                      }
                    >
                      <AccountTree />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Duplicar">
                    <IconButton
                      size="small"
                      onClick={() => handleDuplicate(bot.id)}
                    >
                      <FileCopy />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Editar configuración">
                    <IconButton
                      size="small"
                      onClick={() => openEdit(bot)}
                    >
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDeleting(bot);
                        setConfirmOpen(true);
                      }}
                    >
                      <DeleteOutline />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={5} />}
            {!loading && bots.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Aún no hay bots. Haz clic en "+ Nuevo Bot" para crear uno.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default FlowBotList;
