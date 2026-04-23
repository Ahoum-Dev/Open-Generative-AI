import React from 'react';

export const WorkflowBuilder = () =>
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
    React.createElement('h1', { style: { fontSize: 24, marginBottom: 8 } }, 'Workflows unavailable'),
    React.createElement(
      'p',
      { style: { color: '#ffffff80', maxWidth: 480 } },
      'The workflow-builder package is not bundled with this Ahoum-Dev fork. The Workflows tab is a no-op. See packages/workflow-ui/package.json for context.'
    )
  );
