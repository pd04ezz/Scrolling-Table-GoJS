import {addNodeTemplate} from './NodeTemplateCreator';
import {addLinkTemplate} from './LinkTemplateCreator';
import {handleLinkDrawnEvent, linkDeletionEvent} from '../link/LinkEventHandler';
import {COLOR} from '../constants/ColorConstants';
import {getTheme} from '../hooks/useDiagram';
import {enableDisableMsrAndFilterIcons} from '../node/NodeService';
import {updateAllTargetBindings} from '../canvas/CanvasService';
import {DIMENSION, NODE} from '../constants/NodeConstants';
import {TRANSACTION} from '../constants/TransactionConstants';
import {getStore} from "../../../services/CMStoreService";
import {CM_STORE_NAME_AND_NAME_SPACE} from "../../../Redux/store/CMStoreConstant";
import {CMStoreObjName} from "../../../Redux/constants/CMStoreConstants";
/**
 * initializes the gojs diagram
 * @return {*|jQuery|HTMLElement|void}
 * @constructor
 * @author Monika
 */
const $$ = go.GraphObject.make;

/**
 * This API adds diagram listeners
 * @param {*} diagram 
 */
const _addDiagramEvents = (diagram) => {
    diagram.addDiagramListener("LinkDrawn", handleLinkDrawnEvent);
    diagram.addDiagramListener("InitialLayoutCompleted", () => {
        enableDisableMsrAndFilterIcons(diagram);
        updateAllTargetBindings(diagram);
    });
    diagram.commandHandler.deleteSelection = function (){
        linkDeletionEvent(diagram);
    }

  // support mouse wheel scrolling of table when the mouse is in the table
  diagram.toolManager.doMouseWheel = function () {
    const e = diagram.lastInput;
    let tab = diagram.findObjectAt(e.documentPoint);
    while (tab !== null && !tab._updateScrollBar) tab = tab.panel;
    if (tab !== null) {
      const table = tab.findObject('TABLE');
      if (table) {
        const dir = e.delta > 0 ? -1 : 1;
        const incr = e.shift ? 5 : 1;
        tab._scrollTable?.(table, incr * dir);
      }
      tab._updateScrollBar(table);
      e.handled = true;
      return;
    }
    go.ToolManager.prototype.doMouseWheel.call(this);
  };

}

/**
 * adds modelChangedLister to diagram
 * */
const _addModelChangedListener = (diagram) => {
    //this methods gets called when changes are done in diagram model
    diagram.addModelChangedListener((evt) => {
        if( evt.isTransactionFinished && evt.oldValue === TRANSACTION.CANVAS.INIT_MERGE) {
            diagram.layout = _getDefaultLayout();
            _overrideTheScrollBarButtonProperties(diagram);
            setZoomValue(diagram);
        }
    });
}

export const initOverview = () => {
  return new go.Overview({
    contentAlignment: go.Spot.Center,
    box:
      new go.Part({
        selectable: true, selectionAdorned: false, selectionObjectName: NODE.NAME.OVERVIEW_BOX_SHAPE,
        locationObjectName: NODE.NAME.OVERVIEW_BOX_SHAPE, resizeObjectName: NODE.NAME.OVERVIEW_BOX_SHAPE, cursor: NODE.CURSOR.MOVE
      })
        .add(new go.Shape({
          name: NODE.NAME.OVERVIEW_BOX_SHAPE,
          fill: 'transparent',
          stroke: COLOR[getTheme()].DIAGRAM.OVERVIEW.STROKE,
          strokeWidth: 2
        }))
  });
}

/**
 * This API initializes GoJS diagram
 * @returns GoJs_diagram
 */
function InitDiagram({linkPresent}) {
    const diagram = $$(go.Diagram, _getDiagramProperties(linkPresent));

    diagram.model = $$(go.GraphLinksModel, {
        nodeKeyProperty:"id",
        linkKeyProperty: "key",
        linkFromPortIdProperty: "fromPort",
        linkToPortIdProperty: "toPort"
    });

    _addDiagramEvents(diagram);
    _addModelChangedListener(diagram);
    addNodeTemplate(diagram);
    addLinkTemplate(diagram);

    return diagram;
}

const _getDiagramProperties = (linkPresent) => {
    return {
        hasHorizontalScrollbar: false,
        hasVerticalScrollbar: false,
        "undoManager.isEnabled": true,
        "undoManager.maxHistoryLength": 0,
        layout: linkPresent ? _getLayeredDigraphLayout() : _getGridLayout(),
        "toolManager.mouseWheelBehavior": go.ToolManager.WheelZoom,
        "draggingTool.isCopyEnabled": false,
        "allowCopy" : false,
        "holdDelay": 0,
        "contextMenuTool.isEnabled": false,
        "contextMenuTool.positionContextMenu": (ad, obj) => {
            const button = obj.part.findObject(NODE.NAME.KEBAB_MENU_BUTTON);
            if (button?.getDocumentBounds().containsPoint(obj.diagram.firstInput.documentPoint)) {
                const nodeLocation = obj.part.part.location;
                const currentNodeWidth = obj.diagram.findNodeForKey(obj.part.data.id).actualBounds.width;
                ad.position = new go.Point(nodeLocation.x + currentNodeWidth - 7, nodeLocation.y + 13);
            }
        },
        "PartResized": function(e) {
            const node = e.subject;
            _updateScrollBarOfNodeContent(node);
        },
       "animationManager.isEnabled": false
    };
}

/**
 * returns the layered diagraph layout
 * @private
 */
const _getLayeredDigraphLayout = () => {
    return $$(go.LayeredDigraphLayout, {
        direction: 0,
        layerSpacing: 200,
        columnSpacing: 10,
        setsPortSpots: false
    });
}

/**
 * returns the grid layout
 * @private
 */
const _getGridLayout = () => {
    return $$(go.GridLayout,
        {
            spacing : go.Size.parse("150, 50")
        });
}

/**
 * returns the default layout of gojs
 * @return {go.Layout}
 * @private
 */
const _getDefaultLayout = () => {
    return new go.Layout();
}

/**
 * overriding the cursor of scrollbar bar button
 * @param diagram
 * @private
 */
const _overrideTheScrollBarButtonProperties = (diagram) => {
    diagram.nodes.each( (node) => {
        if(node) {
            const upArrow = node.findObject(NODE.NAME.SCROLLBAR_UP_ARROW);
            const downArrow = node.findObject(NODE.NAME.SCROLLBAR_DOWN_ARROW);

            if(upArrow) {
                upArrow.cursor = NODE.CURSOR.POINTER;
                upArrow.background = 'transparent';
            }
            if(downArrow) {
                downArrow.cursor = NODE.CURSOR.POINTER;
                downArrow.background = 'transparent';
            }
        }

        _updateScrollBarOfNodeContent(node);
    });
}

const _updateScrollBarOfNodeContent = (node) => {
    const scroller = node.findObject(NODE.NAME.NODE_CONTENT_SCROLLING_TABLE);
    if (scroller !== null) {
        const nodeHeight = node.actualBounds.height;
        const nodeHeader = node.findObject(NODE.NAME.NODE_HEADER); //NODE TITLE
        const nodeHeaderHeight = nodeHeader ? nodeHeader.actualBounds.height : 0;
        const nodeContentHeight = nodeHeight - nodeHeaderHeight;

        const noOfColShouldBeVisible = Math.round(nodeContentHeight / DIMENSION.NODE_COLUMN_CONTENT.COLUMN.ROW_HEIGHT);
        const nodeNewHeight = (noOfColShouldBeVisible * DIMENSION.NODE_COLUMN_CONTENT.COLUMN.ROW_HEIGHT) + nodeHeaderHeight;

        node.desiredSize = new go.Size(node.actualBounds.width, nodeNewHeight+4);

        const strokeW = 2;

        scroller.desiredSize = new go.Size(node.actualBounds.width - strokeW, nodeNewHeight - nodeHeaderHeight );
        scroller._updateScrollBar(scroller.findObject("TABLE"));
    }
}

/**
 * overriding the cursor of scrollbar bar button
 * @param diagram
 * @private
 */
export const setZoomValue = (diagram) => {
  const zoomValue = getStore().getState()[CM_STORE_NAME_AND_NAME_SPACE].cubeMappingState[CMStoreObjName.CANVAS_STATE][CMStoreObjName.ZOOM_VALUE];

  if(zoomValue === 0){
    diagram.commandHandler.zoomToFit();
  } else {
    const zoomFactor = zoomValue/100;
    diagram.commandHandler.resetZoom(zoomFactor);
  }
}

export default InitDiagram;
