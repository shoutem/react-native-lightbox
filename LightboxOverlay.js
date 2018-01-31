/**
 * @providesModule LightboxOverlay
 */
'use strict';

var React = require('react');
var createReactClass = require('create-react-class');
var PropTypes = require('prop-types');
var {
  Animated,
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
} = require('react-native');

var ViewTransformer = require('react-native-view-transformer').default;
var WINDOW_HEIGHT = Dimensions.get('window').height;
var WINDOW_WIDTH = Dimensions.get('window').width;

// Translation threshold for closing the image preview
var CLOSING_THRESHOLD = 100;

var LightboxOverlay = createReactClass({
  propTypes: {
    origin: PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number,
      width: PropTypes.number,
      height: PropTypes.number,
    }),
    springConfig: PropTypes.shape({
      tension: PropTypes.number,
      friction: PropTypes.number,
      useNativeDriver: PropTypes.bool,
    }),
    animateOpening: PropTypes.bool,
    animateClosing: PropTypes.bool,
    backgroundColor: PropTypes.string,
    isOpen: PropTypes.bool,
    renderHeader: PropTypes.func,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    swipeToDismiss: PropTypes.bool,
    pinchToZoom: PropTypes.bool,
  },

  getInitialState: function() {
    return {
      isClosing: false,
      target: {
        x: 0,
        y: 0,
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT,
      },
      closingDistance: new Animated.Value(0),
      visibility: new Animated.Value(0),
    };
  },

  getDefaultProps: function() {
    return {
      springConfig: {
        tension: 30,
        friction: 7,
        // Native animations work better on Android, but
        // sometimes still have issues on iOS
        useNativeDriver: Platform.OS === 'android',
      },
      animateOpening: true,
      animateClosing: false,
      backgroundColor: 'black',
      renderHeader: (close) => (
        <TouchableOpacity onPress={close}>
          <Text style={styles.closeButton}>×</Text>
        </TouchableOpacity>
      )
    };
  },

  componentDidMount: function() {
    if(this.props.isOpen) {
      this.open();
    }
  },

  componentWillReceiveProps: function(props) {
    if((this.props.isOpen != props.isOpen) && props.isOpen) {
      this.open();
    }
  },

  startClosing: function() {
    if (this.state.isClosing) {
      return;
    }

    this.setState({ isClosing: true });
  },

  stopClosing: function() {
    if (!this.state.isClosing) {
      return;
    }

    this.state.closingDistance.setValue(0);
    this.setState({ isClosing: false });
  },

  open: function() {
    if (Platform.OS === 'ios') {
      StatusBar.setHidden(true, 'fade');
    }

    const { animateOpening } = this.props;

    if (animateOpening) {
      Animated.spring(
        this.state.visibility,
        { toValue: 1, ...this.props.springConfig }
      ).start();
    } else {
      this.state.visibility.setValue(1);
    }
  },

  close: function() {
    if (Platform.OS === 'ios') {
      StatusBar.setHidden(false, 'fade');
    }

    const { animateClosing } = this.props;
    if (animateClosing) {
      Animated.spring(
        this.state.visibility,
        { toValue: 0, ...this.props.springConfig }
      ).start(() => this.onClose());
    } else {
      this.onClose();
    }
  },

  onClose: function() {
    this.props.onClose();
    this.state.closingDistance.setValue(0);
    this.state.visibility.setValue(0);
    this.setState(this.getInitialState());
  },

  onViewTransformed: function({ translateY, scale }) {
    if (scale > 1) {
      this.stopClosing();
      return;
    }

    this.state.closingDistance.setValue(translateY);
    if (Math.abs(translateY) > 0) {
      this.startClosing();
    } else {
      this.stopClosing();
    }
  },

  onTransformGestureReleased: function({ translateX, translateY, scale }) {
    const { swipeToDismiss } = this.props;

    if(swipeToDismiss && (scale === 1) &&
      ((Math.abs(translateY) > CLOSING_THRESHOLD) ||
      (Math.abs(translateX) > CLOSING_THRESHOLD))
    ) {
      this.setState({
        isClosing: false,
        target: {
          y: translateY,
          x: translateX,
          width: WINDOW_WIDTH,
          height: WINDOW_HEIGHT,
        }
      }, () => this.close());
    } else {
      this.stopClosing();
    }
  },

  render: function() {
    var {
      isOpen,
      renderHeader,
      pinchToZoom,
      origin,
      backgroundColor,
    } = this.props;

    var {
      isClosing,
      visibility,
      target,
    } = this.state;


    var lightboxOpacityStyle = {
      opacity: visibility.interpolate({
        inputRange: [0, 0.8, 1],
        outputRange: [0, 0.4, 1],
      })
    };

    if(isClosing) {
      lightboxOpacityStyle.opacity = this.state.closingDistance.interpolate({
        inputRange: [-CLOSING_THRESHOLD * 2, 0, CLOSING_THRESHOLD * 2],
        outputRange: [0, 1, 0]
      });
    }

    var openStyle = [styles.open, {
      top: target.y,
      left: target.x,
      width: target.width,
      height: target.height,
      transform: [{
        translateX: visibility.interpolate({
          inputRange: [0, 1],
          outputRange: [origin.x, target.x]
        })
      }, {
        translateY: visibility.interpolate({
          inputRange: [0, 1],
          outputRange: [origin.y - origin.height, target.y]
        })
      }, {
        scale: visibility.interpolate({
          inputRange: [0, 1],
          outputRange: [origin.width / WINDOW_WIDTH, 1]
        })
      }],
    }];

    var background = (
      <Animated.View
        style={[
          styles.background,
          { backgroundColor: backgroundColor },
          lightboxOpacityStyle
        ]}
      />
    );
    var header = (
      <Animated.View style={[styles.header, lightboxOpacityStyle]}>
        {renderHeader && renderHeader(this.close)}
      </Animated.View>);

    var content;

    if (!pinchToZoom) {
      content = this.props.children;
    } else {
      content = (
        <ViewTransformer
          style={{flex: 1}}
          enableTransform={true}
          enableScale={true}
          enableTranslate={true}
          enableResistance={true}
          contentAspectRatio={origin.width / origin.height}
          maxScale={3}
          onTransformGestureReleased={this.onTransformGestureReleased}
          onViewTransformed={this.onViewTransformed}
        >
          {this.props.children}
        </ViewTransformer>
      );
    }

    return (
      <Modal
        visible={isOpen}
        transparent={true}
        hardwareAccelerated
        onRequestClose={this.close}
      >
        {background}
        <Animated.View style={openStyle}>
          {content}
        </Animated.View>
        {header}
      </Modal>
    );
  }
});

var styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  },
  open: {
    position: 'absolute',
    justifyContent: 'center',
    // Android pan handlers crash without this declaration:
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    backgroundColor: 'transparent',
  },
  closeButton: {
    fontSize: 35,
    color: 'white',
    lineHeight: 40,
    width: 40,
    textAlign: 'center',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 1.5,
    shadowColor: 'black',
    shadowOpacity: 0.8,
  },
});

module.exports = LightboxOverlay;
