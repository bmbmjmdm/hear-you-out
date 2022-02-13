import {View, TouchableOpacity, StyleSheet, Text, Dimensions} from 'react-native'
import React from 'react'

type TutorialElementProps = {
  onPress: () => void,
  isInTutorial: boolean,
  currentElement: string,
  id: string,
  children: React.ReactElement,
  calloutText?: string,
  calloutTheme?: "question" | "answer",
  calloutDistance?: number,
  measureDistanceFromBottom?: boolean,
  inheritedFlex?: number
}

const TutorialElement = ({onPress, isInTutorial, currentElement, id, children, calloutText, calloutTheme, calloutDistance, measureDistanceFromBottom = true, inheritedFlex} : TutorialElementProps) => {
  const childRef = React.useRef(null)
  const [left, setLeft] = React.useState(0)
  const [height, setHeight] = React.useState(0)

  // when not in the tutorial, we dont want to alter the children at all
  if (!isInTutorial) return children

  const isFocused = currentElement === id
  // when in the tutorial, we want to make the children inert (we create an overlay to take away their press events)
  // we also add a heavy transparency to them if they arent the one currently in focus
  // when the element is in focus, we also show its tooltip
  // when the user clicks on the element while its in focus or its tooltip, they proceed in the tutorial
  return (
    <>
    {isFocused && calloutText && 
      <TouchableOpacity
        style={[
          styles.tooltipOuter, 
          {top: calloutDistance + height, marginLeft: left},
          styles.elevated
        ]}
        activeOpacity={1}
        onPress={onPress}
      >
        <View style={styles.tooltipInner}>
          <Text style={calloutTheme === 'answer' ? styles.modalTextAnswer : styles.modalTextQuestion}>
            { calloutText }
          </Text>
        </View>
      </TouchableOpacity>
    }

    <TouchableOpacity
      activeOpacity={1}
      onPress={isFocused ? onPress : () => {}}
      ref={childRef}
      onLayout={(layout) => {
        // only measure if we have real layout values
        if (layout.nativeEvent.layout.height) {
          layout.persist()
          childRef.current.measure( (fx, fy, w, h, px, py) => {
            const bottom = measureDistanceFromBottom ? h : 0
            setHeight(layout.nativeEvent.layout.y + bottom) // this allows us to offset the tooltip properly based on the element's y and height
            setLeft(layout.nativeEvent.layout.x - px) // this allows us to center the tooltip properly based on window width and true left, not the parent
        })
        }
      }}
    >
      <View style={{opacity: isFocused ? 1 : 0.25, flex: inheritedFlex}}>
        <View style={styles.disableClicks} />
        { children }
      </View>
    </TouchableOpacity>
    </>
  )
}

const tooltipWidth = 320

const styles = StyleSheet.create({
  elevated: {
    elevation: 1,
    zIndex: 1,
  },

  disableClicks: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: '100%',
    zIndex: 1,
    elevation: 1
  },

  tooltipInner: {
    width: tooltipWidth
  },

  tooltipOuter: {
    position: 'absolute',
    left: (Dimensions.get('window').width / 2) - (tooltipWidth / 2) //centers our modal horizontally based on window, not parent
  },

  modalTextAnswer: {
    fontSize: 25,
    textAlign: 'center',
    backgroundColor: '#BFECE7',
    borderRadius: 20,
    padding: 10,
    paddingVertical: 15,
    borderColor: '#A9C5F2',
    borderWidth: 3,
    overflow: "hidden"
  },

  modalTextQuestion: {
    fontSize: 25,
    textAlign: 'center',
    backgroundColor: 'rgb(255, 212, 198)',
    borderRadius: 20,
    padding: 10,
    paddingVertical: 15,
    borderColor: '#FFADBB',
    borderWidth: 3,
    overflow: "hidden"
  },
})

export default TutorialElement