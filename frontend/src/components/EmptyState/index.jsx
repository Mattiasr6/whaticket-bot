import React from "react";
import PropTypes from "prop-types";
import { makeStyles } from "@material-ui/core/styles";
import { Typography } from "@material-ui/core";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(6, 2),
    textAlign: "center",
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    backgroundColor: theme.palette.action.hover,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing(2),
    "& svg": {
      width: 36,
      height: 36,
      color: theme.palette.text.secondary,
    },
  },
  title: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  message: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3),
    maxWidth: 360,
  },
  compact: {
    padding: theme.spacing(3, 2),
    "& $iconWrapper": {
      width: 56,
      height: 56,
      "& svg": { width: 28, height: 28 },
    },
  },
}));

const EmptyState = ({ icon, title, message, action, compact, onClick }) => {
  const classes = useStyles();

  return (
    <div className={clsx(classes.root, compact && classes.compact)} onClick={onClick}>
      {icon && <div className={classes.iconWrapper}>{icon}</div>}
      <Typography className={classes.title} variant="h6">
        {title}
      </Typography>
      {message && (
        <Typography className={classes.message} variant="body2">
          {message}
        </Typography>
      )}
      {action && action}
    </div>
  );
};

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  message: PropTypes.string,
  action: PropTypes.node,
  compact: PropTypes.bool,
  onClick: PropTypes.func,
};

export default EmptyState;
