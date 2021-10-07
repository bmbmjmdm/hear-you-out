
import React from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
} from 'react-native';
import CheckBox from '@react-native-community/checkbox';

const Checklist = ({type}) => {
  return (
    <View style={styles.checkList}>
      <CheckItem text={"This is a test asd asd jasd asdas,d aljksdjksdfsdffs s sd sd "} />
      <CheckItem text={"This is a test asd asd jasd asdas,d aljksdjksdfsdffs s sd sd "} />
      <CheckItem text={"This is a test asd asd jasd asdas,d aljksdjksdfsdffs s sd sd "} />
    </View>
  )
};

const CheckItem = ({text}) => {
  return (
    <View style={styles.checkItem}>
      <CheckBox 
        tintColors={{
          true: "#9a9a9a"
        }}
        onFillColor={"#9a9a9a"}
      />
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}
// make text clickable for box too


const styles = StyleSheet.create({
  checkList: {
    marginRight: 20,
    height: 300
  },
  checkItem: {
    alignItems: 'center',
    marginBottom: 10,
    flexDirection: 'row'
  },
  text: {
    fontSize: 20,
    marginLeft: 10,
    maxWidth: 250
  }
});

export default Checklist;
