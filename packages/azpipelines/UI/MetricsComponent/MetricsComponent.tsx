import React = require("react");
import "./MetricsComponent.scss";


export interface IMetricsState {
    isShow:boolean;
  }

  
export interface IMetricsProps {
    title:string;
    value:number;
  }


export default class MetricsComponent extends React.Component<IMetricsProps,IMetricsState> {
  constructor(props: IMetricsProps) {
    super(props);
    this.state = {
        isShow:false
      };
  }

  public render(): JSX.Element {
    return (
      <div className="pmd-card-item">
        <p className="bolt-header-title body-xl m">{this.props.title}</p>
        <p className="card-metrics-value font-size-lll flex-self-end">
          {this.props.value}
        </p>
      </div>
    );
  }
}
