/*
 * ABBYY® Mobile Web Capture © 2019 ABBYY Production LLC.
 * ABBYY is either a registered trademark or a trademark of ABBYY Software Ltd.
 */

const app = angular.module('promo', ['ngMaterial', 'ui.router']);

// Route config
app.config([
  '$stateProvider',
  '$urlRouterProvider',
  function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/');

    $stateProvider
      .state('root', {
        url: '/',
        views: {
          content: {
            templateUrl: './templates/scan.html',
            controller: 'scanCtrl',
            controllerAs: '$ctrl',
          },
          title: {
            templateUrl: './templates/form_title.html',
          },
        },
      })
      .state('final', {
        url: '/final',
        views: {
          content: {
            templateUrl: './templates/final.html',
          },
          title: {
            templateUrl: './templates/final_title.html',
          },
        },
      });
  },
]);

app.controller('scanCtrl', [
  '$scope',
  '$http',
  '$state',
  function($scope, $http, $state) {
    const self = this;

    // form data
    self.titles = ['', 'Mr', 'Miss', 'Mrs', 'Ms'];
    self.personal = {
      title: '',
      name: '',
      lastname: '',
      birthday: '',
      address: '',
      email: '',
    };

    // Mobile Web Capture settings with data
    self.capturedData = {
      license: {
        images: [],
        maxImagesCount: 1,
        template: 'DriverLicense',
      },
      utilityBill: {
        images: [],
        maxImagesCount: 1,
        template: 'utility_bill',
      },
    };

    self.webCaptureInitialized = false;

    // auxiliary arr to restore images
    self.storedImages = [];

    // on app init
    self.$onInit = function() {
      self.initCapture();
    };

    // initialized webCapture library with license file
    self.initCapture = function() {
      window.ABBYY.WebCapture.init({
        licenseFilePath: './MWC.ABBYY.License', // relative to wasm files (default folder libs/js) or absolute path
        wasmFilesPath: '../libs/js', // relative to flexi-capture/index.html or absolute path
      })
        .then(() => {
          self.webCaptureInitialized = true;
          $scope.$apply();
        })
        .catch((e) => {
          console.error('Error during initialization: ' + e.toString());
        });
    };

    // rescan image
    self.rescan = function(scanName) {
      // store previous images to temp arr
      self.storedImages = self.capturedData[scanName].images;
      self.capturedData[scanName].images = [];
      // run MWC with empty img array
      self.scan(scanName);
    };

    // set previous scan image
    self.setPreviousImg = function(scanName) {
      self.capturedData[scanName].images = self.storedImages;
    };

    // scan and save image
    self.scan = function(scanName) {
      const options = {
        images: self.capturedData[scanName].images,
        maxImagesCount: self.capturedData[scanName].maxImagesCount,
      };

      // run webcapture module
      window.ABBYY.WebCapture.capture(options)
        .then((imgArr) => {
          if (imgArr.length === 0) {
            // restore saved images
            this.setPreviousImg(scanName);
            return;
          }

          self.capturedData[scanName].images = imgArr;
        })
        .finally(function() {
          $scope.$apply();
        })
        .catch((e) => {
          console.error('Error during capture: ' + e.toString());
        });
    };

    // get extention file from base64
    self.getExtensionFromBase64 = function(base64) {
      const block = base64.split(';');
      const contentType = block[0].split(':')[1];
      return contentType.split('/')[1];
    };

    // convert image from base64 to blob
    self.b64toBlob = async (b64) => {
      const response = await fetch(b64);
      return await response.blob();
    };

    // create array data from form data for send on server
    self.getFormParamsArr = function() {
      return Object.keys(self.personal).reduce((acc, key) => {
        if (self.personal[key] !== '') {
          return [{ name: key, value: self.personal[key] }, ...acc];
        }

        return acc;
      }, []);
    };

    // send on FC server images
    self.submit = async function() {
      const formDataToUpload = new window.FormData();

      const templateKeys = Object.keys(self.capturedData);

      // documents to send to FC
      const documents = templateKeys.map((key) => {
        return {
          template: self.capturedData[key].template,
          pages: [],
        };
      });

      const imagePromises = [];
      // process all images to form data
      templateKeys.forEach((capturedDataKey, j) => {
        // for each template images
        const values = self.capturedData[capturedDataKey];

        values.images.forEach((imageResult, i) => {
          const imageBase64 = imageResult.capturedImage;

          // create image name & extension
          const extension = self.getExtensionFromBase64(imageBase64);
          const name = `${capturedDataKey}_${i}.${extension}`;

          imagePromises.push(
            new Promise(async (resolve) => {
              // generate image blob from base64
              const imageBlob = await self.b64toBlob(imageBase64);

              // append image file to formData
              formDataToUpload.append(name, imageBlob, name);

              // push image name to form documents data
              documents[j].pages.push(name);

              // resolve promise
              resolve();
            })
          );
        });
      });

      // wait all images to processed
      await Promise.all(imagePromises);

      // generate url to FC server endpoint
      let url = `/flexicloudapi?projectName=CarLoan`;

      formDataToUpload.append(
        'BatchStructure',
        angular.toJson({
          regParams: self.getFormParamsArr(),
          documents,
        })
      );

      $http
        .post(url, formDataToUpload, {
          transformRequest: angular.identity,
          headers: { 'Content-Type': undefined },
        })
        .then(
          // on success show final view
          function(response) {
            $state.go('final');
          },
          function(response) {
            console.log(response);
          }
        );
    };
  },
]);
