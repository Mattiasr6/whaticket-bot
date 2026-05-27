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
  Tooltip,
  Chip
} from "@material-ui/core";
import { Edit, DeleteOutline } from "@material-ui/icons";

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
    minWidth: 480,
  },
}));

const actionOptions = [
  { value: "send_message", label: "Send Message" },
];

const CronJobs = () => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    actionType: "send_message",
    cronExpr: "0 */6 * * *",
    whatsappId: "",
    config: '{"toJid":"","text":"","mediaFile":""}',
    enabled: true,
  });

  const [configFields, setConfigFields] = useState({
    toJid: "",
    text: "",
    mediaFile: "",
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/cron-jobs");
      setJobs(data);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      actionType: "send_message",
      cronExpr: "0 */6 * * *",
      whatsappId: whatsApps.length > 0 ? whatsApps[0].id : "",
      config: '{"toJid":"","text":"","mediaFile":""}',
      enabled: true,
    });
    setConfigFields({ toJid: "", text: "", mediaFile: "" });
    setModalOpen(true);
  };

  const openEdit = (job) => {
    setEditing(job);
    const config = JSON.parse(job.config || "{}");
    setForm({
      name: job.name,
      actionType: job.actionType,
      cronExpr: job.cronExpr,
      whatsappId: job.whatsappId || "",
      config: job.config || "{}",
      enabled: job.enabled,
    });
    setConfigFields({
      toJid: config.toJid || "",
      text: config.text || "",
      mediaFile: config.mediaFile || "",
    });
    setModalOpen(true);
  };

  const handleConfigChange = (field, value) => {
    const newFields = { ...configFields, [field]: value };
    setConfigFields(newFields);
    setForm({ ...form, config: JSON.stringify(newFields) });
  };

  const handleSave = async () => {
    if (!form.name || !form.cronExpr) {
      toast.warn("Name and cron expression are required");
      return;
    }
    try {
      if (editing) {
        await api.put(`/cron-jobs/${editing.id}`, form);
        toast.success("Cron job updated");
      } else {
        await api.post("/cron-jobs", form);
        toast.success("Cron job created");
      }
      setModalOpen(false);
      fetchJobs();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/cron-jobs/${deleting.id}`);
      toast.success("Cron job deleted");
      setConfirmOpen(false);
      setDeleting(null);
      fetchJobs();
    } catch (err) {
      toastError(err);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : "-";

  const presetExamples = [
    { label: "Every 30 min", value: "*/30 * * * *" },
    { label: "Every hour", value: "0 * * * *" },
    { label: "Every 6 hours", value: "0 */6 * * *" },
    { label: "Daily at 9am", value: "0 9 * * *" },
    { label: "Mon-Fri 8am", value: "0 8 * * 1-5" },
  ];

  return (
    <MainContainer>
      <ConfirmationModal
        title={`Delete "${deleting?.name || ""}"?`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      >
        This will permanently remove the cron job.
      </ConfirmationModal>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md">
        <DialogTitle>{editing ? "Edit Cron Job" : "New Cron Job"}</DialogTitle>
        <DialogContent>
          <div className={classes.form}>
            <TextField
              label="Job Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth margin="dense"
            />

            <FormControl fullWidth margin="dense">
              <InputLabel>Action Type</InputLabel>
              <Select
                value={form.actionType}
                onChange={(e) => setForm({ ...form, actionType: e.target.value })}
              >
                {actionOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Cron Expression"
              value={form.cronExpr}
              onChange={(e) => setForm({ ...form, cronExpr: e.target.value })}
              fullWidth margin="dense"
              placeholder="*/30 * * * *"
              helperText="min hour day month weekday"
            />

            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {presetExamples.map((p) => (
                <Chip
                  key={p.value}
                  label={p.label}
                  size="small"
                  clickable
                  color={form.cronExpr === p.value ? "primary" : "default"}
                  onClick={() => setForm({ ...form, cronExpr: p.value })}
                />
              ))}
            </div>

            <FormControl fullWidth margin="dense">
              <InputLabel>WhatsApp Connection</InputLabel>
              <Select
                value={form.whatsappId}
                onChange={(e) => setForm({ ...form, whatsappId: e.target.value })}
              >
                {whatsApps.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name} ({w.status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {form.actionType === "send_message" && (
              <>
                <TextField
                  label="Destination JID"
                  value={configFields.toJid}
                  onChange={(e) => handleConfigChange("toJid", e.target.value)}
                  fullWidth margin="dense"
                  placeholder="1234567890-123456@g.us or 573001234567@s.whatsapp.net"
                />
                <TextField
                  label="Message Text"
                  value={configFields.text}
                  onChange={(e) => handleConfigChange("text", e.target.value)}
                  fullWidth multiline rows={3} margin="dense"
                />
                <TextField
                  label="Media File (in public/ folder)"
                  value={configFields.mediaFile}
                  onChange={(e) => handleConfigChange("mediaFile", e.target.value)}
                  fullWidth margin="dense"
                  placeholder="e.g. qr-pago.png"
                />
              </>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
              }
              label="Enabled"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} color="secondary">Cancel</Button>
          <Button onClick={handleSave} color="primary" variant="contained">
            {editing ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <MainHeader>
        <Title>Cron Jobs</Title>
        <MainHeaderButtonsWrapper>
          <Button variant="contained" color="primary" onClick={openCreate}>
            Add Cron Job
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">Name</TableCell>
              <TableCell align="center">Action</TableCell>
              <TableCell align="center">Schedule</TableCell>
              <TableCell align="center">Last Run</TableCell>
              <TableCell align="center">Next Run</TableCell>
              <TableCell align="center">Active</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell align="center">{job.name}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={actionOptions.find((o) => o.value === job.actionType)?.label || job.actionType}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <code>{job.cronExpr}</code>
                </TableCell>
                <TableCell align="center">{formatDate(job.lastRunAt)}</TableCell>
                <TableCell align="center">{formatDate(job.nextRunAt)}</TableCell>
                <TableCell align="center">
                  <Tooltip title={job.enabled ? "Active" : "Disabled"}>
                    <span style={{ color: job.enabled ? "green" : "gray", fontWeight: "bold" }}>
                      {job.enabled ? "ON" : "OFF"}
                    </span>
                  </Tooltip>
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => openEdit(job)}><Edit /></IconButton>
                  <IconButton size="small" onClick={() => { setDeleting(job); setConfirmOpen(true); }}>
                    <DeleteOutline />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={7} />}
            {!loading && jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No cron jobs yet. Click "Add Cron Job" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default CronJobs;
