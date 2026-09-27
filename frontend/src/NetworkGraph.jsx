import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network';

function NetworkGraph({ data, onNodeClick }) {
  const container = useRef(null);
  const network = useRef(null);

  useEffect(() => {
    if (container.current && data) {
      const visNodes = data.nodes.map(node => {
        // 1. Base Node Setup
        let shape = 'box';
        let backgroundColor = '#3b82f6'; // Default Blue
        let shadowColor = '#3b82f6';
        let labelText = node.name || node.label || node.id;
        let fontColor = '#000000'; // Black text for readability

        // 2. Assign Symbols and Colors based on Entity Label/Type
        if (labelText.match(/^[6-9]\d{9}$/)) {
            // Phone Anchors
            labelText = '📞 ' + labelText;
            backgroundColor = '#22c55e'; // Green
            shadowColor = '#22c55e';
        } else if (labelText.match(/^[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4}$/i)) {
            // Vehicle Anchors
            labelText = '🚘 ' + labelText;
            backgroundColor = '#f59e0b'; // Orange/Yellow
            shadowColor = '#f59e0b';
        } else if (labelText.includes('@')) {
            // Financial/Bank Anchors
            labelText = '🏦 ' + labelText.split('@')[0]; // Show account, hide IFSC for cleaner UI
            backgroundColor = '#a855f7'; // Purple
            shadowColor = '#a855f7';
        } else if (labelText.startsWith('FIR_') || node.label === 'Case') {
            // FIR Documents
            labelText = '📄 ' + labelText;
            backgroundColor = '#64748b'; // Slate
            shadowColor = '#000000'; // No glow for cases
        } else {
            // Suspects / Persons
            labelText = '👤 ' + labelText;
        }

        // 3. NEXUS OVERRIDE (High Centrality)
        const centralityScore = node.metrics?.betweenness_centrality || 0;
        const isNexus = (centralityScore > 0.4) && (node.label !== 'Case'); // Threshold for Nexus, excluding Documents

        if (isNexus) {
            shape = 'circle';
            backgroundColor = '#ef4444'; // Bright Red
            shadowColor = '#ff0000';
        }

        // 4. Return formatting to vis.js
        return {
            id: node.id,
            label: labelText,
            shape: shape,
            color: {
                background: backgroundColor,
                border: '#1e293b',
                highlight: { background: '#ffffff', border: backgroundColor }
            },
            font: { 
                color: fontColor, 
                face: 'Inter, sans-serif',
                size: 14,
                bold: isNexus // Make Nexus text bold
            },
            shadow: {
                enabled: true,
                color: shadowColor,
                size: isNexus ? 25 : 10, // Massive neon glow for Nexus, subtle glow for others
                x: 0,
                y: 0
            },
            title: `Name: ${node.name || node.label}\nBetweenness Centrality: ${centralityScore}\nRisk Tier: ${node.risk_tier || 'LOW'}` // Tooltip data
        };
      });

      const visData = {
        nodes: visNodes,
        edges: data.edges.map(edge => ({ ...edge, font: { align: 'middle' } }))
      };

      const options = {
        nodes: {
            font: {
                face: "'Inter', 'Segoe UI', Roboto, sans-serif", // Clean, modern font
                size: 15,
                color: '#000000', // Keeps text highly readable inside the colored boxes
                vadjust: 1
            },
            borderWidth: 0, // Removes messy borders around the nodes
        },
        edges: {
            font: {
                face: "'Inter', 'Segoe UI', Roboto, sans-serif",
                size: 12,
                color: '#00ADB5', // Teal text for relationship labels
                strokeWidth: 4,   // Creates a smooth cutout effect
                strokeColor: '#222831', // Matches the graph's Deep Slate background perfectly
                align: 'middle'
            },
            color: {
                color: '#393E46', // Dark gray lines (subtle, doesn't clash with neon nodes)
                highlight: '#00ADB5'
            },
            smooth: {
                type: 'continuous',
                roundness: 0.5
            },
            arrows: {
                to: { enabled: true, scaleFactor: 0.6 }
            }
        },
        layout: {
            improvedLayout: true,
            hierarchical: false
        },
        physics: {
            enabled: true,
            solver: 'barnesHut',
            barnesHut: {
                gravitationalConstant: -4000, // Strong negative gravity pushes nodes away from each other
                centralGravity: 0.1,          // Lower central gravity stops them from pulling into a tight middle ball
                springLength: 250,            // Increases the minimum length of the relationship edges
                springConstant: 0.04,
                damping: 0.09                 // Prevents the graph from jittering infinitely
            },
            stabilization: {
                enabled: true,
                iterations: 150,              // Pre-calculates the layout so it loads cleanly 
                updateInterval: 25
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 200,
            navigationButtons: true,          // Adds zoom/pan controls to the canvas
            keyboard: true
        }
      };

      network.current = new Network(container.current, visData, options);

      network.current.on('click', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = data.nodes.find(n => n.id === nodeId);
          if (node) {
            onNodeClick(node);
          }
        }
      });
    }

    return () => {
      if (network.current) {
        network.current.destroy();
      }
    };
  }, [data, onNodeClick]);

  return <div ref={container} style={{ height: '100%', width: '100%', minHeight: '350px' }} className="bg-transparent" />;
}

export default NetworkGraph;
