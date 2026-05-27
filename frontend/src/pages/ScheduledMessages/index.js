import React, { useState, useEffect, useContext } from "react";
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
  Tooltip
} from "@material-ui/core";
import { Edit, DeleteOutline, PlayArrow } from "@material-ui/icons";

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
    minWidth: 400,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  enabled: { color: theme.palette.success.main },
  disabled: { color: theme.palette.grey[500] },
}));

const ScheduledMessages = () => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [form, setForm] = useState({
    whatsappId: "",
    groupJid: "",
    groupName: "",
    messageText: "",
    mediaPath: "",
    mediaName: "",
    intervalMinutes: 1440,
    enabled: true,
  });

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/scheduled-messages");
      setMessages(data);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      whatsappId: whatsApps.length > 0 ? whatsApps[0].id : "",
      groupJid: "",
      groupName: "",
      messageText: "",
      mediaPath: "",
      mediaName: "",
      intervalMinutes: 1440,
      enabled: true,
    });
    setModalOpen(true);
  };

  const openEdit = (msg) => {
    setEditing(msg);
    setForm({
      whatsappId: msg.whatsappId,
      groupJid: msg.groupJid,
      groupName: msg.groupName,
      messageText: msg.messageText || "",
      mediaPath: msg.mediaPath || "",
      mediaName: msg.mediaName || "",
      intervalMinutes: msg.intervalMinutes,
      enabled: msg.enabled,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.groupJid || !form.groupName) {
      toast.warn("Group JID and name are required");
      return;
    }
    if (!form.messageText && !form.mediaPath) {
      toast.warn("Add a message text or media file");
      return;
    }
    try {
      if (editing) {
        await api.put(`/scheduled-messages/${editing.id}`, form);
        toast.success("Scheduled message updated");
      } else {
        await api.post("/scheduled-messages", form);
        toast.success("Scheduled message created");
      }
      setModalOpen(false);
      fetchMessages();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/scheduled-messages/${deleting.id}`);
      toast.success("Scheduled message deleted");
      setConfirmOpen(false);
      setDeleting(null);
      fetchMessages();
    } catch (err) {
      toastError(err);
    }
  };

  const handleToggleEnabled = async (msg) => {
    try {
      await api.put(`/scheduled-messages/${msg.id}`, { enabled: !msg.enabled });
      fetchMessages();
    } catch (err) {
      toastError(err);
    }
  };

  const formatInterval = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return `${days}d ${hours}h`;
  };

  const formatLastSent = (date) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  const connectedWhats = whatsApps.filter(
    (w) => w.status === "CONNECTED"
  );

  return (
    <MainContainer>
      <ConfirmationModal
        title={`Delete "${deleting?.groupName || ""}"?`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      >
        This will remove the scheduled message permanently.
      </ConfirmationModal>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
        <DialogTitle>
          {editing ? "Edit Scheduled Message" : "New Scheduled Message"}
        </DialogTitle>
        <DialogContent>
          <div className={classes.form}>
            <FormControl fullWidth margin="dense">
              <InputLabel>WhatsApp Connection</InputLabel>
              <Select
                value={form.whatsappId}
                onChange={(e) =>
                  setForm({ ...form, whatsappId: e.target.value })
                }
              >
                {connectedWhats.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name}
                  </MenuItem>
                ))}
                {connectedWhats.length === 0 && (
                  <MenuItem disabled>No connected WhatsApps</MenuItem>
                )}
              </Select>
            </FormControl>

            <TextField
              label="Group Name"
              value={form.groupName}
              onChange={(e) =>
                setForm({ ...form, groupName: e.target.value })
              }
              fullWidth
              margin="dense"
            />

            <TextField
              label="Group JID (e.g. 1234567890-123456@g.us)"
              value={form.groupJid}
              onChange={(e) =>
                setForm({ ...form, groupJid: e.target.value })
              }
              fullWidth
              margin="dense"
              placeholder="Find this in contact list after receiving a group message"
            />

            <TextField
              label="Message Text (optional if media attached)"
              value={form.messageText}
              onChange={(e) =>
                setForm({ ...form, messageText: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
              margin="dense"
            />

            <TextField
              label="Media filename (in public/ folder)"
              value={form.mediaPath}
              onChange={(e) =>
                setForm({ ...form, mediaPath: e.target.value, mediaName: e.target.value })
              }
              fullWidth
              margin="dense"
              placeholder="e.g. mi-qr.png"
              helperText="Place file in backend/public/ folder on the server"
            />

            <TextField
              label="Interval (minutes)"
              type="number"
              value={form.intervalMinutes}
              onChange={(e) =>
                setForm({ ...form, intervalMinutes: Number(e.target.value) })
              }
              fullWidth
              margin="dense"
              inputProps={{ min: 1 }}
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
              label="Active"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} color="primary" variant="contained">
            {editing ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <MainHeader>
        <Title>Scheduled Messages</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            onClick={openCreate}
          >
            Add Scheduled Message
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">Group</TableCell>
              <TableCell align="center">Message</TableCell>
              <TableCell align="center">Media</TableCell>
              <TableCell align="center">Interval</TableCell>
              <TableCell align="center">Last Sent</TableCell>
              <TableCell align="center">Active</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {messages.map((msg) => (
              <TableRow key={msg.id}>
                <TableCell align="center">{msg.groupName}</TableCell>
                <TableCell align="center">
                  {msg.messageText
                    ? msg.messageText.substring(0, 50)
                    : "-"}
                </TableCell>
                <TableCell align="center">
                  {msg.mediaName || "-"}
                </TableCell>
                <TableCell align="center">
                  {formatInterval(msg.intervalMinutes)}
                </TableCell>
                <TableCell align="center">
                  {formatLastSent(msg.lastSentAt)}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title={msg.enabled ? "Active" : "Disabled"}>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleEnabled(msg)}
                    >
                      <PlayArrow
                        className={
                          msg.enabled ? classes.enabled : classes.disabled
                        }
                      />
                    </IconButton>
                  </Tooltip>
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => openEdit(msg)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setDeleting(msg);
                      setConfirmOpen(true);
                    }}
                  >
                    <DeleteOutline />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={7} />}
            {!loading && messages.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No scheduled messages yet. Click "Add Scheduled Message" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default ScheduledMessages;
