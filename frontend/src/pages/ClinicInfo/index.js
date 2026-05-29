import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Paper, Typography, TextField, Button,
  Container, Grid, Snackbar
} from "@material-ui/core";
import { Save as SaveIcon } from "@material-ui/icons";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  container: { paddingTop: theme.spacing(4), paddingBottom: theme.spacing(4) },
  paper: { padding: theme.spacing(3), borderRadius: 12 },
  title: { fontWeight: 700, marginBottom: theme.spacing(1) },
  subtitle: { color: theme.palette.text.secondary, marginBottom: theme.spacing(3), fontSize: "0.85rem" },
  editor: {
    width: "100%",
    minHeight: 400,
    fontFamily: "'Fira Code', 'Consolas', monospace",
    fontSize: "0.85rem",
    lineHeight: 1.6,
    padding: theme.spacing(2),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    "&:focus": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -1 },
  },
  saveBtn: { marginTop: theme.spacing(2) },
}));

const ClinicInfo = () => {
  const classes = useStyles();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: "" });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/clinic-info");
        setContent(data.content || "");
      } catch { /* file not exists yet */ }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/clinic-info", { content });
      setSnack({ open: true, msg: "Información guardada. El agente usará los nuevos datos." });
    } catch {
      setSnack({ open: true, msg: "Error al guardar" });
    }
    setSaving(false);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Container maxWidth="lg" className={classes.container}>
      <Paper className={classes.paper}>
        <Typography variant="h5" className={classes.title}>
          Información de la Clínica
        </Typography>
        <Typography variant="body2" className={classes.subtitle}>
          Todo lo que escribas aquí el AI Agent lo leerá automáticamente. 
          Usá texto plano o markdown. Cambios son inmediatos, sin recargar ni deploy.
          <br /><strong>Atajo:</strong> Ctrl+S para guardar.
        </Typography>

        {loading ? (
          <Typography>Cargando...</Typography>
        ) : (
          <>
            <textarea
              className={classes.editor}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`# Mi Clínica

## Horarios
Lun-Vie: 8:00 - 18:00
Sáb: 8:00 - 12:00

## Precios
- Consulta general: Bs.100
- Consulta especialista: Bs.150

## Médicos
| Nombre | Especialidad | Horario |
|--------|-------------|---------|
| ...`}
            />
            <Grid container justify="space-between" alignItems="center" className={classes.saveBtn}>
              <Grid item>
                <Typography variant="caption" color="textSecondary">
                  Texto plano / Markdown — el agente interpreta ambos
                </Typography>
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </Grid>
            </Grid>
          </>
        )}
      </Paper>
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        message={snack.msg}
      />
    </Container>
  );
};

export default ClinicInfo;
