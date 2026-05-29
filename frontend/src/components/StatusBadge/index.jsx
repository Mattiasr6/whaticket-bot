import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { green, orange, red, grey } from "@material-ui/core/colors";

const useStyles = makeStyles(theme => ({
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
  },
}));

const statusColors = {
  CONNECTED: { bg: green[50], text: green[800] },
  DISCONNECTED: { bg: red[50], text: red[800] },
  OPENING: { bg: orange[50], text: orange[800] },
  PAIRING: { bg: orange[50], text: orange[800] },
  TIMEOUT: { bg: red[50], text: red[800] },
  qrcode: { bg: orange[50], text: orange[800] },
};

const StatusBadge = ({ status }) => {
  const classes = useStyles();
  const colors = statusColors[status] || { bg: grey[100], text: grey[800] };

  return (
    <span
      className={classes.badge}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
