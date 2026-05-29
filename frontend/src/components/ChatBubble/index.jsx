import React from "react";
import PropTypes from "prop-types";
import { makeStyles } from "@material-ui/core/styles";
import { Paper, Typography } from "@material-ui/core";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
  row: {
    display: "flex",
    marginBottom: theme.spacing(1),
  },
  fromMe: {
    justifyContent: "flex-end",
  },
  fromThem: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "75%",
    padding: theme.spacing(1.5, 2),
    borderRadius: 12,
    wordBreak: "break-word",
  },
  myBubble: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    borderBottomLeftRadius: 4,
  },
  time: {
    fontSize: "0.7rem",
    marginTop: 4,
    opacity: 0.7,
    textAlign: "right",
  },
  typing: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: theme.spacing(1.5, 2),
    "& span": {
      width: 8,
      height: 8,
      borderRadius: "50%",
      backgroundColor: theme.palette.text.secondary,
      animation: "$pulse 1.4s infinite ease-in-out",
      "&:nth-child(1)": { animationDelay: "0s" },
      "&:nth-child(2)": { animationDelay: "0.2s" },
      "&:nth-child(3)": { animationDelay: "0.4s" },
    },
  },
  "@keyframes pulse": {
    "0%, 80%, 100%": { transform: "scale(0.6)", opacity: 0.4 },
    "40%": { transform: "scale(1)", opacity: 1 },
  },
}));

const ChatBubble = ({ message, fromMe, time, typing }) => {
  const classes = useStyles();

  if (typing) {
    return (
      <div className={clsx(classes.row, classes.fromThem)}>
        <Paper className={clsx(classes.bubble, classes.theirBubble, classes.typing)}>
          <span /><span /><span />
        </Paper>
      </div>
    );
  }

  return (
    <div className={clsx(classes.row, fromMe ? classes.fromMe : classes.fromThem)}>
      <Paper className={clsx(classes.bubble, fromMe ? classes.myBubble : classes.theirBubble)}>
        <Typography variant="body2">{message}</Typography>
        {time && <div className={classes.time}>{time}</div>}
      </Paper>
    </div>
  );
};

ChatBubble.propTypes = {
  message: PropTypes.string,
  fromMe: PropTypes.bool,
  time: PropTypes.string,
  typing: PropTypes.bool,
};

export default ChatBubble;
