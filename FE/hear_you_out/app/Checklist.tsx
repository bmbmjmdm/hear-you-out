
import React, { useImperativeHandle, forwardRef } from 'react'
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  Platform,
} from 'react-native';
import CheckBox from '@react-native-community/checkbox';
import ShakeElement from "./ShakeElement"
import FadeInElement from './FadeInElement';

interface ChecklistProps {
  shouldFadeInText: boolean,
  shouldFadeInBoxes: boolean,
  isVisibleWithoutAnimation: boolean,
  list: Array<string>,
  disabledPress?: Function
}

const Checklist = ({list, disabledPress, shouldFadeInText, shouldFadeInBoxes, isVisibleWithoutAnimation} : ChecklistProps, ref) => {
  const allRefs = React.useRef({}).current
  if (!list) list = [
    "Answer the question with as much detail as possible",
  ]
  const itemComponents = []

  // expose a function that goes through all items in the checklist to see if theyre all checked
  useImperativeHandle(ref, () => ({
    areAllChecked: () => {
      for (const i in allRefs) {
        if (!allRefs[i].isChecked()) return false
      }
      return true
    },
    uncheckAll: () => {
      for (const i in allRefs) {
        allRefs[i].uncheck()
      }
    },
    shake: () => {
      for (const i in allRefs) {
        allRefs[i].shake()
      }
    }
  }))
  
  // construct our checklist items from our known checklist map + type
  for (const i in list) {
    itemComponents.push(
      <CheckItemWithRef
        text={list[i]}
        key={i}
        ref={curRef => allRefs[i] = curRef}
        disabledPress={disabledPress}
        shouldFadeInText={shouldFadeInText}
        shouldFadeInBox={shouldFadeInBoxes}
        isVisibleWithoutAnimation={isVisibleWithoutAnimation}
      />
    )
  }

  return (
    <ScrollView
      style={styles.checkList}
      horizontal={false}
      alwaysBounceHorizontal={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      { itemComponents }
    </ScrollView>
  )
};

// a single item with a check and text
const CheckItem = ({text, disabledPress, shouldFadeInText, shouldFadeInBox, isVisibleWithoutAnimation}, ref) => {
  const [val, setVal] = React.useState(false)
  const shakeRef = React.useRef(null)
  
  // expose our checked value to the parent
  useImperativeHandle(ref, () => ({
    isChecked: () => val,
    shake: () => {
      if (!val) shakeRef.current.shake()
    },
    uncheck: () => {
      setVal(false)
    },
  }))

  return (
    <View style={styles.checkItem}>
      <FadeInElement
        shouldFadeIn={shouldFadeInBox}
        isVisibleWithoutAnimation={isVisibleWithoutAnimation}
      >
        <ShakeElement ref={shakeRefNew => shakeRef.current = shakeRefNew}>
          <CheckBox
            value={val}
            onValueChange={newVal => {
              if (disabledPress) disabledPress()
              else setVal(newVal)
            }}
            tintColors={{
              true: "#D0D3D5",
              false: "#D0D3D5"
            }}
            disabled={disabledPress}
            onFillColor={Platform.OS === "android" ? "#D0D3D5" : undefined}
            onCheckColor={"#D0D3D5"}
            onTintColor={"#D0D3D5"}
            tintColor={"#D0D3D5"}
            onAnimationType={"one-stroke"}
            offAnimationType={"one-stroke"}
            style={Platform.OS === "android" ? {} : {
              width: 25,
              height: 25,
              marginRight: 5,
            }}
          />
        </ShakeElement>
      </FadeInElement>
      <FadeInElement
        shouldFadeIn={shouldFadeInText}
        isVisibleWithoutAnimation={isVisibleWithoutAnimation}
      >
        <Text
          style={styles.text}
          onPress={() => {
            if (disabledPress) disabledPress()
            else setVal(!val)
          }}
        >
          {text}
        </Text>
      </FadeInElement>
    </View>
  )
}

const CheckItemWithRef = forwardRef(CheckItem)


const styles = StyleSheet.create({
  checkList: {
    width: "100%",
    overflow: "hidden",
    flex: 1,
  },
  checkItem: {
    marginBottom: 10,
    flexDirection: 'row',
    padding: 1,
  },
  text: {
    fontSize: 20,
    paddingLeft: 10,
    marginBottom: 3,
    maxWidth: 310,
    flexGrow: 1,
    color: '#F0F3F5'
  }
});

export default forwardRef(Checklist)
