import "./PMDAnalysisTab.scss";

import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import {
  ObservableArray,
  ObservableValue
} from "azure-devops-ui/Core/Observable";
import 'react-virtualized/styles.css'

import {Column, Table, AutoSizer, InfiniteLoader, SortDirection, SortIndicator } from 'react-virtualized';
import { showRootComponent } from "../Common";
import { getClient } from "azure-devops-extension-api";
import {
  BuildRestClient,
  IBuildPageDataService,
  BuildServiceIds,
} from "azure-devops-extension-api/Build";
import CodeAnalysisRetriever from "./CodeAnalysis/CodeAnalysisRetriever";
import CodeAnalysisArtifactProcessor, {
  CodeAnalysisResult,
  CodeAnalyisDetail
} from "./CodeAnalysis/CodeAnalysisArtifactProcessor";

import MetricsComponent from "../MetricsComponent/MetricsComponent";

interface IBuildInfoTabState {
  isDataLoaded: boolean;
  criticaldefects: number;
  violationCount: number;
  affectedFileCount: number;
  details: CodeAnalyisDetail[];
  loadedRowCount: number;
  loadedRowsMap: any;
  loadingRowCount: number;
  sortBy: any,
  sortDirection: any,
  sortedList: any,
}

const STATUS_LOADING = 1;
const STATUS_LOADED = 2;

class PMDAnalysisTab extends React.Component<{}, IBuildInfoTabState> {
  private itemProvider = new ObservableArray<
    CodeAnalyisDetail | ObservableValue<CodeAnalyisDetail | undefined>
  >();

  accessToken = "0";
  results: CodeAnalysisResult[] | undefined = [];
  result: CodeAnalysisResult | undefined = undefined;
  _timeoutIdMap;


  constructor(props: {}) {
    super(props);

    const sortBy = 'index';
    const sortDirection = SortDirection.ASC;
    const sortedList = this._sortList({sortBy, sortDirection});

    this.state = {
      isDataLoaded: false,
      criticaldefects: 0,
      violationCount: 0,
      affectedFileCount: 0,
      details: [],
      loadedRowCount: 0,
      loadedRowsMap: {},
      loadingRowCount: 0,
      sortBy,
      sortDirection,
      sortedList,
    };

    this._timeoutIdMap = {};

    this._isRowLoaded = this._isRowLoaded.bind(this);
    this._loadMoreRows = this._loadMoreRows.bind(this);
    this._sort = this._sort.bind(this);
    this._sortList = this._sortList.bind(this);
  }

  componentWillUnmount() {
    Object.keys(this._timeoutIdMap).forEach(timeoutId => {
      let tId = timeoutId ? timeoutId : 0
      if (typeof tId === 'string') {
        tId = parseInt(tId)
      } 
      clearTimeout(tId);
    });
  }

  public async componentDidMount() {
    this.initializeState();
  }

  private async initializeState(): Promise<void> {
    SDK.init();
    await SDK.ready();

    this.setState({ isDataLoaded: false });

    const buildInfo = await SDK.getService<IBuildPageDataService>(
      BuildServiceIds.BuildPageDataService
    );
    const buildPageData = await buildInfo.getBuildPageData();
    const client = getClient(BuildRestClient);

    this.setState({ isDataLoaded: true });

    let codeAnalysisRetriever: CodeAnalysisRetriever = new CodeAnalysisRetriever(
      client,
      buildPageData!.definition!.project.id,
      buildPageData!.build!.id
    );

    var codeAnalysisReport: string[] = await codeAnalysisRetriever.downloadCodeAnalysisArtifact();

    let codeAnalysisProcessor: CodeAnalysisArtifactProcessor = new CodeAnalysisArtifactProcessor(
      codeAnalysisReport[0]
    );
    this.result = await codeAnalysisProcessor.processCodeQualityFromArtifact();
    this.setState({
      isDataLoaded: true,
      criticaldefects: this.result.criticaldefects,
      violationCount: this.result.violationCount,
      affectedFileCount: this.result.affectedFileCount,
      details: this.result.details,
      sortedList: this.result.details,
    });

    for (let i = 0; i < this.state.details.length; i++) {
      if (this.state.details[i].priority <= 3) {
        let asyncRow = new ObservableValue<CodeAnalyisDetail | undefined>(
          undefined
        );
        asyncRow.value = this.state.details[i];
        this.itemProvider.push(asyncRow);
      }
    }
  }

  _getDatum(list, index) {
    return list.get(index % this.state.details.length);
  }

  _isRowLoaded({index}) {
    const {loadedRowsMap} = this.state;
    return !!loadedRowsMap[index]; // STATUS_LOADING or STATUS_LOADED
  }

  _loadMoreRows({startIndex, stopIndex}) {
    const {loadedRowsMap, loadingRowCount} = this.state;
    const increment = stopIndex - startIndex + 1;

    for (var i = startIndex; i <= stopIndex; i++) {
      loadedRowsMap[i] = STATUS_LOADING;
    }

    this.setState({
      loadingRowCount: loadingRowCount + increment,
    });

    const timeoutId = setTimeout(() => {
      const {loadedRowCount, loadingRowCount} = this.state;

      // delete this._timeoutIdMap[timeoutId];

      for (var i = startIndex; i <= stopIndex; i++) {
        loadedRowsMap[i] = STATUS_LOADED;
      }

      this.setState({
        loadingRowCount: loadingRowCount - increment,
        loadedRowCount: loadedRowCount + increment,
      });

      promiseResolver();
    }, 1000 + Math.round(Math.random() * 2000));

    this._timeoutIdMap["timeoutId"] = true;

    let promiseResolver;

    return new Promise(resolve => {
      promiseResolver = resolve;
    });
  }

  _sort({sortBy, sortDirection}) {
    let sortedList = this._sortList({sortBy, sortDirection});

    if (sortDirection === SortDirection.DESC) {
      sortedList = sortedList.reverse()
    }

    this.setState({sortBy, sortDirection, sortedList});
  }

  _sortList({sortBy, sortDirection}) {
    return this.state ? this.state.details.sort((a, b) => {
      const bandA = typeof a[sortBy] === 'string' ? a[sortBy].toUpperCase() : a;
      const bandB = typeof b[sortBy] === 'string' ? b[sortBy].toUpperCase() : b;
    
      let comparison = 0;
      if (bandA > bandB) {
        comparison = 1;
      } else if (bandA < bandB) {
        comparison = -1;
      }
      return comparison;
    }) : []
  }


  public render(): JSX.Element {
    const rowGetter = ({index}) => this.state.sortedList[index] ? this.state.sortedList[index] : {};
    
    return (
      <div className="container">
        {!this.state.isDataLoaded && (
          <div className="loader-container">
            <div className="loader"></div>
            <span>Loading...</span>
          </div>
        )}
        {this.state.isDataLoaded && (
          <>
          <div className="flex-row pmd-tiles">
            <MetricsComponent
              title={"Total Issues"}
              value={this.state.violationCount}
            />
            <MetricsComponent
              title={"Critical Defects"}
              value={this.state.criticaldefects}
            />
            <MetricsComponent
              title={"Affected"}
              value={this.state.affectedFileCount}
            />
          </div>
          <InfiniteLoader
            isRowLoaded={this._isRowLoaded}
            loadMoreRows={this._loadMoreRows}
            rowCount={this.state.details.length}>
            {({onRowsRendered, registerChild}) => (
            <AutoSizer>
                {({width, height}) => (
              <Table
                  ref={registerChild}
                  width={width}
                  height={500}
                  autoHeight={ false }
                  headerHeight={20}
                  rowHeight={30}
                  rowCount={this.state.details.length}
                  onRowsRendered={onRowsRendered}
                  sort={this._sort}
                  sortBy={this.state.sortBy}
                  sortDirection={this.state.sortDirection}
                  rowGetter={ rowGetter } >  
                  <Column label="File Name" dataKey="filename" width={600} />
                  <Column label="Line Number" dataKey="beginLine" width={150 } />
                  <Column label="Priority" dataKey="priority"  width={150 } />
                  <Column label="Problem" dataKey="problem" />
              </Table>
                )}
            </AutoSizer>
          )}
          </InfiniteLoader>
          </>
        )}
      </div>
    );
  }
}

showRootComponent(<PMDAnalysisTab />);
