import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";

/**
 * PUBLIC_INTERFACE
 * CanvasWorkspace
 * A client-side image composition workspace that allows:
 * - Uploading one or multiple images (input and drag-and-drop)
 * - Displaying the images as layers inside a "canvas" area
 * - Selecting and dragging images to reposition them (bounded within the area)
 * - Clearing the canvas
 *
 * Usage:
 * <CanvasWorkspace />
 *
 * Notes:
 * - This is a client-only feature. No backend integration is required.
 * - Object URLs are used for displaying uploaded images. They are revoked when layers are removed/cleared.
 * - Styling follows the Ocean Professional theme.
 */
function CanvasWorkspace() {
  const [layers, setLayers] = useState([]); // [{id, src, x, y, width, height, isSelected}]
  const [dragState, setDragState] = useState(null); // {id, offsetX, offsetY}
  const containerRef = useRef(null);
  const idCounterRef = useRef(0);

  // Theme variables (Ocean Professional)
  const theme = useMemo(
    () => ({
      primary: "#2563EB",
      secondary: "#F59E0B",
      background: "#f9fafb",
      surface: "#ffffff",
      text: "#111827",
      shadow: "0 8px 20px rgba(17, 24, 39, 0.08)",
      border: "1px solid rgba(17, 24, 39, 0.08)",
      radius: "12px",
    }),
    []
  );

  // Helper to compute a default size for an image to fit within the workspace.
  const computeFit = useCallback((imgWidth, imgHeight, maxWidth, maxHeight) => {
    if (imgWidth <= 0 || imgHeight <= 0) return { width: 100, height: 100 };
    const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);
    return { width: Math.round(imgWidth * scale), height: Math.round(imgHeight * scale) };
  }, []);

  // Add files to layers
  const handleFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const maxWidth = Math.max((rect?.width ?? 800) - 32, 100);
      const maxHeight = Math.max((rect?.height ?? 500) - 32, 100);

      const newLayers = [];
      for (const file of files) {
        if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) continue;
        const src = URL.createObjectURL(file);

        // Load image to get intrinsic size
        const dims = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.onerror = () => resolve({ w: 100, h: 100 });
          img.src = src;
        });

        const { width, height } = computeFit(dims.w, dims.h, maxWidth, maxHeight);

        // Place near center with slight stagger to visualize multiple uploads
        const baseX = Math.round(((rect?.width ?? 800) - width) / 2);
        const baseY = Math.round(((rect?.height ?? 500) - height) / 2);
        const offset = newLayers.length * 16;

        idCounterRef.current += 1;
        newLayers.push({
          id: idCounterRef.current,
          src,
          x: baseX + offset,
          y: baseY + offset,
          width,
          height,
          isSelected: false,
        });
      }

      if (newLayers.length > 0) {
        setLayers((prev) => [...prev, ...newLayers]);
      }
    },
    [computeFit]
  );

  // File input change
  const onFileInputChange = useCallback(
    (e) => {
      const files = e.target.files;
      handleFiles(files);
      // reset value so selecting the same file again works
      e.target.value = "";
    },
    [handleFiles]
  );

  // Drag & Drop handlers
  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dt = e.dataTransfer;
      if (dt?.files && dt.files.length > 0) {
        handleFiles(dt.files);
      }
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Select a layer and start drag
  const onLayerPointerDown = useCallback((e, id) => {
    // Prevent default to stop text/image drag ghosting
    e.preventDefault();
    e.stopPropagation();

    const containerRect = containerRef.current?.getBoundingClientRect();
    const pointerX = e.clientX - (containerRect?.left ?? 0);
    const pointerY = e.clientY - (containerRect?.top ?? 0);

    setLayers((prev) =>
      prev.map((l) => ({
        ...l,
        isSelected: l.id === id,
      }))
    );

    setDragState((prev) => {
      const layer = layers.find((l) => l.id === id) || { x: 0, y: 0 };
      return {
        id,
        offsetX: pointerX - layer.x,
        offsetY: pointerY - layer.y,
      };
    });

    // Set pointer capture for smoother dragging
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [layers]);

  // Drag move
  const onContainerPointerMove = useCallback(
    (e) => {
      if (!dragState || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== dragState.id) return l;
          // New position constrained within container bounds
          const maxX = Math.max(rect.width - l.width, 0);
          const maxY = Math.max(rect.height - l.height, 0);
          let nx = Math.round(pointerX - dragState.offsetX);
          let ny = Math.round(pointerY - dragState.offsetY);
          nx = Math.max(0, Math.min(nx, maxX));
          ny = Math.max(0, Math.min(ny, maxY));
          return { ...l, x: nx, y: ny };
        })
      );
    },
    [dragState]
  );

  // End drag
  const onContainerPointerUp = useCallback(() => {
    setDragState(null);
  }, []);

  // Clear canvas (revoke object URLs)
  const clearCanvas = useCallback(() => {
    setLayers((prev) => {
      prev.forEach((l) => {
        try {
          URL.revokeObjectURL(l.src);
        } catch {
          // ignore
        }
      });
      return [];
    });
  }, []);

  // Revoke URLs on unmount
  useEffect(() => {
    return () => {
      layers.forEach((l) => {
        try {
          URL.revokeObjectURL(l.src);
        } catch {
          // ignore
        }
      });
    };
  }, [layers]);

  // Styles
  const styles = useMemo(() => {
    return {
      root: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        maxWidth: 1200,
        margin: "0 auto",
        padding: "16px",
      },
      toolbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: theme.surface,
        border: theme.border,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        padding: "12px 16px",
      },
      leftGroup: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
      },
      rightGroup: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
      },
      uploadLabel: {
        background: theme.primary,
        color: "#fff",
        border: "none",
        borderRadius: "10px",
        padding: "10px 14px",
        cursor: "pointer",
        fontWeight: 600,
        transition: "transform 0.15s ease, box-shadow 0.2s ease",
        boxShadow: "0 6px 14px rgba(37, 99, 235, 0.25)",
      },
      clearBtn: {
        background: theme.secondary,
        color: "#111827",
        border: "none",
        borderRadius: "10px",
        padding: "10px 14px",
        cursor: "pointer",
        fontWeight: 600,
        transition: "transform 0.15s ease, box-shadow 0.2s ease",
        boxShadow: "0 6px 14px rgba(245, 158, 11, 0.25)",
      },
      hint: {
        color: theme.text,
        opacity: 0.7,
        fontSize: 14,
      },
      workspaceWrapper: {
        background: theme.surface,
        border: theme.border,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        padding: "12px",
      },
      workspace: {
        position: "relative",
        width: "100%",
        minHeight: "420px",
        height: "60vh",
        maxHeight: "700px",
        background: `linear-gradient(180deg, rgba(37, 99, 235, 0.05) 0%, rgba(249, 250, 251, 0.6) 100%)`,
        borderRadius: theme.radius,
        overflow: "hidden",
        outline: "2px dashed rgba(37, 99, 235, 0.25)",
        outlineOffset: "-8px",
      },
      dropOverlay: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      },
      imgLayer: (selected) => ({
        position: "absolute",
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
        boxShadow: selected ? "0 6px 16px rgba(37, 99, 235, 0.35)" : "0 4px 12px rgba(17, 24, 39, 0.15)",
        outline: selected ? "3px solid rgba(37, 99, 235, 0.65)" : "none",
        borderRadius: "8px",
        transition: "box-shadow 0.12s ease",
      }),
      header: {
        color: theme.text,
        fontSize: 18,
        fontWeight: 700,
      },
    };
  }, [theme]);

  return (
    <div style={styles.root}>
      {/* Minimal toolbar */}
      <div style={styles.toolbar} role="toolbar" aria-label="Canvas toolbar">
        <div style={styles.leftGroup}>
          <span style={styles.header}>Workspace</span>
        </div>
        <div style={styles.rightGroup}>
          {/* Upload button */}
          <label htmlFor="image-uploader" style={styles.uploadLabel}>
            Upload Images
          </label>
          <input
            id="image-uploader"
            type="file"
            accept="image/png, image/jpeg"
            multiple
            onChange={onFileInputChange}
            style={{ display: "none" }}
            aria-label="Upload images"
          />
          {/* Clear button */}
          <button type="button" onClick={clearCanvas} style={styles.clearBtn} aria-label="Clear canvas">
            Clear Canvas
          </button>
        </div>
      </div>

      {/* Workspace area with drag-and-drop */}
      <div
        ref={containerRef}
        style={styles.workspaceWrapper}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div
          style={styles.workspace}
          onPointerMove={onContainerPointerMove}
          onPointerUp={onContainerPointerUp}
          onPointerLeave={onContainerPointerUp}
          role="region"
          aria-label="Canvas workspace"
        >
          {/* Hint text */}
          {layers.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: theme.text,
                opacity: 0.6,
                fontSize: 16,
                textAlign: "center",
                padding: "0 24px",
              }}
            >
              <div>
                Drag & drop images here or use the Upload Images button
                <div style={{ marginTop: 8, ...styles.hint }}>
                  Supported formats: PNG, JPG, JPEG. Click and drag images to reposition them.
                </div>
              </div>
            </div>
          )}

          {/* Render image layers */}
          {layers.map((layer) => (
            <img
              key={layer.id}
              src={layer.src}
              alt={`layer-${layer.id}`}
              draggable={false}
              onPointerDown={(e) => onLayerPointerDown(e, layer.id)}
              style={{
                ...styles.imgLayer(layer.isSelected),
                left: layer.x,
                top: layer.y,
                width: layer.width,
                height: layer.height,
              }}
            />
          ))}

          {/* Invisible overlay to capture drops */}
          <div style={styles.dropOverlay} aria-hidden="true" />
        </div>
      </div>

      {/* Usage note */}
      <div
        style={{
          color: theme.text,
          opacity: 0.75,
          fontSize: 13,
          textAlign: "center",
        }}
      >
        Tip: Upload one or more images, then click an image to select and drag it around. Use Clear Canvas to remove all.
      </div>
    </div>
  );
}

export default CanvasWorkspace;
