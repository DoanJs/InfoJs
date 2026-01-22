interface Props {
    height?: number;
    width?: number;
  }
  
  export default function SpinnerComponent(props: Props) {
    const { height, width } = props;
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div
          className="spinner-border"
          role="status"
          style={{ height: height ?? 26, width: width ?? 26 }}
        >
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }