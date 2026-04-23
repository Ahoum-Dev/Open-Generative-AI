import React from 'react';

const Unavailable = ({ feature }) =>
  React.createElement(
    'div',
    {
      style: {
        padding: '2rem',
        color: '#fff',
        background: '#0a0a0a',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        fontFamily: 'sans-serif',
        textAlign: 'center',
      },
    },
    React.createElement('h1', { style: { fontSize: 24, marginBottom: 8 } }, 'Agents unavailable'),
    React.createElement(
      'p',
      { style: { color: '#ffffff80', maxWidth: 480 } },
      `The ai-agent package is not bundled with this Ahoum-Dev fork. The /agents/${feature} route is a no-op. See packages/ai-agent/package.json for context.`
    )
  );

export const CreateAgentPage = () => Unavailable({ feature: 'create' });
export const EditAgentPage = () => Unavailable({ feature: 'edit' });
export const AiAgent = () => Unavailable({ feature: 'chat' });
