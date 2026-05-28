const humanDelay = (): Promise<void> => {
  const ms = 20000 + Math.floor(Math.random() * 20000);
  return new Promise(resolve => setTimeout(resolve, ms));
};

const variaRespuesta = (respuestas: string[]): string => {
  return respuestas[Math.floor(Math.random() * respuestas.length)];
};

export { humanDelay, variaRespuesta };
