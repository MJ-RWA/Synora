export const getIceServers = (): RTCConfiguration => {
  const customTurnUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TURN_SERVER_URL;
  const customTurnUsername = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TURN_USERNAME;
  const customTurnCredential = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TURN_CREDENTIAL;

  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:openrelay.metered.ca:80' },
  ];

  if (customTurnUrl) {
    servers.push({
      urls: customTurnUrl,
      username: customTurnUsername,
      credential: customTurnCredential,
    });
  }

  return {
    iceServers: servers,
    iceCandidatePoolSize: 10,
  };
};
