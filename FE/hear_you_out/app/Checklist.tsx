
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

const Checklist = ({type, disabledPress} : {type:string, disabledPress?: Function}, ref) => {
  const allRefs = React.useRef({}).current
  let itemList = checklist_map[type]
  if (!itemList) itemList = checklist_map["other"]
  const itemComponents = []

  // expose a function that goes through all items in the checklist to see if theyre all checked
  useImperativeHandle(ref, () => ({
    areAllChecked: () => {
      for (const i in allRefs) {
        if (!allRefs[i].isChecked()) return false
      }
      return true
    },
    shake: () => {
      for (const i in allRefs) {
        allRefs[i].shake()
      }
    }
  }))
  
  // construct our checklist items from our known checklist map + type
  for (const i in itemList) {
    itemComponents.push(
      <CheckItemWithRef text={itemList[i]} key={i} ref={curRef => allRefs[i] = curRef} disabledPress={disabledPress} />
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

// backend tells us the type, we know the checklist items based on this type
const checklist_map = {
  political: [
    "Answer the question",
    "Provide supporting arguments and facts. Cite specific sources if possible (ex: name of website/newspaper)",
    "Give your understanding of the Opposing argument(s) and why you think they're wrong"
  ],
  other: [
    "Answer the question with as much detail as possible",
  ],
}

// a single item with a check and text
const CheckItem = ({text, disabledPress}, ref) => {
  const [val, setVal] = React.useState(false)
  const shakeRef = React.useRef(null)
  
  // expose our checked value to the parent
  useImperativeHandle(ref, () => ({
    isChecked: () => val,
    shake: () => {
      if (!val) shakeRef.current.shake()
    }
  }))

  return (
    <View style={styles.checkItem}>
      <ShakeElement ref={shakeRefNew => shakeRef.current = shakeRefNew}>
        <CheckBox
          value={val}
          onValueChange={newVal => {
            if (disabledPress) disabledPress()
            else setVal(newVal)
          }}
          tintColors={{
            true: "#575757"
          }}
          onFillColor={Platform.OS === "android" ? "#575757" : undefined}
          onCheckColor={"#222222"}
          onTintColor={"#222222"}
          tintColor={"#575757"}
          onAnimationType={"one-stroke"}
          offAnimationType={"one-stroke"}
          style={Platform.OS === "android" ? {} : {
            width: 25,
            height: 25,
            marginRight: 5
          }}
        />
      </ShakeElement>
      <Text
        style={styles.text}
        onPress={() => {
          if (disabledPress) disabledPress()
          else setVal(!val)
        }}
      >
        {text}
      </Text>
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
    alignItems: 'center',
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
  }
});

export default forwardRef(Checklist)
