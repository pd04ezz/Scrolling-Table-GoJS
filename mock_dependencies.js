// Mocking project-specific dependencies for isolated testing of InitDiagramVirtualized.js

export const handleLinkDrawnEvent = () => console.log("Link Drawn Event");
export const linkDeletionEvent = () => console.log("Link Deleted Event");

export const COLOR = {
    light: {
        DIAGRAM: {
            OVERVIEW: { STROKE: "blue" }
        }
    },
    dark: {
        DIAGRAM: {
            OVERVIEW: { STROKE: "cyan" }
        }
    }
};

export const getTheme = () => "light";

export const enableDisableMsrAndFilterIcons = () => console.log("Icons Updated");
export const updateAllTargetBindings = () => console.log("Bindings Updated");

export const DIMENSION = {
    NODE_COLUMN_CONTENT: {
        COLUMN: { ROW_HEIGHT: 26 } // Standard height
    }
};

export const NODE = {
    NAME: {
        OVERVIEW_BOX_SHAPE: "OVERVIEW_BOX_SHAPE",
        NODE_CONTENT_SCROLLING_TABLE: "SCROLLER",
        NODE_HEADER: "HEADER",
        SCROLLBAR_UP_ARROW: "UP",
        SCROLLBAR_DOWN_ARROW: "DOWN",
        KEBAB_MENU_BUTTON: "KEBAB"
    },
    CURSOR: {
        MOVE: "move",
        POINTER: "pointer"
    }
};

export const TRANSACTION = {
    CANVAS: {
        INIT_MERGE: "InitMerge"
    }
};

export const getStore = () => ({
    getState: () => ({
        CM_STORE: {
            cubeMappingState: {
                CANVAS_STATE: {
                    ZOOM_VALUE: 100
                }
            }
        }
    })
});

export const CM_STORE_NAME_AND_NAME_SPACE = "CM_STORE";

export const CMStoreObjName = {
    CANVAS_STATE: "CANVAS_STATE",
    ZOOM_VALUE: "ZOOM_VALUE"
};
